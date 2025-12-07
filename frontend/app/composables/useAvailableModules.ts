import { computed, useAsyncData, useRequestHeaders } from '#imports'
import { useAuth } from './useAuth'
import { usePermission } from './usePermission'
import type { ModuleStatusDto } from '~/types/modules'

export const useAvailableModules = () => {
  const modulesStore = useModules()
  const { hasPermission } = usePermission()

  const allModules = computed(() => modulesStore.modules.value ?? [])

  const availableModules = computed(() =>
    allModules.value.filter((module: ModuleStatusDto) => {
      if (!module.effectiveEnabled || module.effectiveDisabled) return false
      if (!module.requiredPermissions?.length) return true
      return module.requiredPermissions.some((permission) =>
        hasPermission(permission as any)
      )
    })
  )

  const isModuleAvailable = (moduleKey: string) =>
    availableModules.value.some((module: ModuleStatusDto) => module.key === moduleKey)

  const getModuleLink = (moduleKey: string) =>
    availableModules.value.find((module: ModuleStatusDto) => module.key === moduleKey)?.rootRoute ??
    null

  return {
    modules: availableModules,
    allModules,
    pending: modulesStore.loading,
    refresh: modulesStore.fetchVisibleModules,
    isModuleAvailable,
    getModuleLink
  }
}

