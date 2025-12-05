import { computed, useAsyncData, useRequestHeaders } from '#imports'
import { useAuth } from './useAuth'
import { usePermission } from './usePermission'
import type { RbacPermission } from '~/constants/rbac'

interface AvailableModule {
  key: string
  name: string
  description: string
  category: string
  layerKey: string
  rootRoute: string
  scopes: string[]
  featureFlag?: string
  requiredPermissions: RbacPermission[]
  tenantEnabled?: boolean
  tenantDisabled?: boolean
  orgEnabled?: boolean
  orgDisabled?: boolean
  effectiveEnabled: boolean
  effectiveDisabled?: boolean
}

export const useAvailableModules = () => {
  const auth = useAuth()
  const { hasPermission } = usePermission()
  const currentOrgId = computed(() => auth.currentOrg.value?.id)
  const headers = useRequestHeaders(['cookie'])

  const {
    data,
    pending,
    refresh
  } = useAsyncData<{ modules: AvailableModule[] }>(
    () => `available-modules-${currentOrgId.value || 'none'}`,
    async () => {
      const orgId = currentOrgId.value
      if (!orgId) {
        return { modules: [] }
      }

      const response = await $fetch<{ modules: AvailableModule[] }>(
        `/api/organizations/${orgId}/modules`,
        {
          credentials: 'include',
          headers: import.meta.server ? headers : undefined
        }
      )

      return {
        modules: response.modules || []
      }
    },
    {
      default: () => ({ modules: [] }),
      watch: [currentOrgId]
    }
  )

  const allModules = computed(() => data.value?.modules ?? [])

  const availableModules = computed(() =>
    allModules.value.filter((module) => {
      if (!module.effectiveEnabled || module.effectiveDisabled) {
        return false
      }

      if (!module.requiredPermissions?.length) {
        return true
      }

      return module.requiredPermissions.some((permission) => hasPermission(permission))
    })
  )

  const isModuleAvailable = (moduleKey: string) =>
    availableModules.value.some((module) => module.key === moduleKey)

  const getModuleLink = (moduleKey: string) =>
    availableModules.value.find((module) => module.key === moduleKey)?.rootRoute ?? null

  return {
    modules: availableModules,
    allModules,
    pending,
    refresh,
    isModuleAvailable,
    getModuleLink
  }
}

