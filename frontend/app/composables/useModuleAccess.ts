import { computed } from '#imports'
import type { ModuleStatusDto } from '~/types/modules'
import type { RbacPermission } from '~/constants/rbac'
import { usePermission } from './usePermission'
import { useAvailableModules } from './useAvailableModules'

interface ModuleAccessResult {
  canView: boolean
  hasRequiredPermission: boolean
  module?: ModuleStatusDto
}

/**
 * Lightweight helper to check if a module is available for the current org
 * and the user has any of the required permissions.
 * Note: user-specific module role overrides are handled server-side when fetching modules.
 */
export const useModuleAccess = () => {
  const { hasPermission } = usePermission()
  const { modules, allModules, pending, refresh } = useAvailableModules()

  const canAccess = (moduleKey: string): ModuleAccessResult => {
    const module = allModules.value.find((m) => m.key === moduleKey)
    if (!module) {
      return { canView: false, hasRequiredPermission: false }
    }

    const hasRequiredPermission =
      !module.requiredPermissions?.length ||
      module.requiredPermissions.some((permission: RbacPermission) => hasPermission(permission))

    const canView = Boolean(module.effectiveEnabled && hasRequiredPermission && !module.effectiveDisabled)

    return { canView, hasRequiredPermission, module }
  }

  return {
    modules,
    pending,
    refresh,
    canAccess
  }
}




