import { computed } from '#imports'
import { usePermission } from './usePermission'
import type { VisibleModule } from './useModules'

export const useAvailableModules = () => {
  const modulesStore = useModules()
  const { hasPermission } = usePermission()

  const allModules = computed(() => modulesStore.modules.value ?? [])

  const availableModules = computed(() =>
    allModules.value.filter((module: VisibleModule) => {
      if (!module.effectiveEnabled || module.effectiveDisabled) return false
      if (!module.requiredPermissions?.length) return true
      return module.requiredPermissions.some((permission: string) =>
        hasPermission(permission as any)
      )
    })
  )

  const isModuleAvailable = (moduleKey: string) =>
    availableModules.value.some((module: VisibleModule) => module.key === moduleKey)

  const getModuleLink = (moduleKey: string) =>
    availableModules.value.find((module: VisibleModule) => module.key === moduleKey)?.rootRoute ??
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

