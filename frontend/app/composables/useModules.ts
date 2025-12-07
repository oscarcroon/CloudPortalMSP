import { computed, useAsyncData, useRequestHeaders } from '#imports'
import { useAuth } from './useAuth'
import type { ModuleDefinition } from '~/constants/modules'

/**
 * Extended module definition with disabled status from API
 */
export interface VisibleModule extends ModuleDefinition {
  disabled?: boolean
  effectiveEnabled?: boolean
  effectiveDisabled?: boolean
}

/**
 * Composable for managing modules and their visibility
 */
export const useModules = () => {
  const auth = useAuth()
  const currentOrgId = computed(() => auth.currentOrg.value?.id)

  const headers = useRequestHeaders(['cookie'])

  const {
    data: visibleModules,
    pending: loading,
    refresh: fetchVisibleModules
  } = useAsyncData<VisibleModule[]>(
    () => `available-modules-${currentOrgId.value || 'none'}`,
    async () => {
      const orgId = currentOrgId.value
      if (!orgId) {
        return []
      }

      try {
        const response = await $fetch<{ modules: VisibleModule[] }>(`/api/organizations/${orgId}/modules`, {
          credentials: 'include',
          headers: import.meta.server ? headers : undefined
        })
        const modules = response.modules || []
        // Mappa API (ModuleStatusDto) till VisibleModule shape
        return modules.map((m) => ({
          ...m,
          id: m.key,
          routePath: m.rootRoute,
          badge: m.category,
          icon: m.icon,
          disabled: !m.effectiveEnabled || m.effectiveDisabled
        }))
      } catch (error) {
        console.error('Failed to fetch modules:', error)
        return []
      }
    },
    {
      default: () => [],
      watch: [currentOrgId]
    }
  )

  /**
   * All modules (synliga enl. API, kan inkludera utgråade)
   */
  const modules = computed(() => visibleModules.value || [])

  /**
   * Only modules that are effectively enabled (used by dashboard/navbar)
   */
  const availableModules = computed(() =>
    modules.value.filter(
      (module: VisibleModule) => module.effectiveEnabled && !module.effectiveDisabled
    )
  )

  /**
   * Check if a module is visible (enabled)
   */
  const isModuleVisible = (moduleId: string) => {
    return (visibleModules.value || []).some((m: any) => m.id === moduleId)
  }

  /**
   * Check if a module is disabled (deactivated)
   */
  const isModuleDisabled = (moduleId: string) => {
    const module = (visibleModules.value || []).find((m: any) => m.id === moduleId)
    return module?.disabled === true
  }

  return {
    modules,
    availableModules,
    visibleModules,
    loading,
    fetchVisibleModules,
    isModuleVisible,
    isModuleDisabled
  }
}

