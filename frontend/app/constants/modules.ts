import type { RbacPermission } from './rbac'
import {
  ALL_MODULES,
  type ModuleMeta,
  type ModuleRoleMeta,
  type ModuleScope,
  type ModuleVisibilityMode
} from '~/lib/module-registry'

export type ModuleId = ModuleMeta['key']
export type ModuleCategory = ModuleMeta['category']
export { ModuleScope, ModuleRoleMeta as ModuleRoleDefinition, ModuleVisibilityMode }

export type ModuleRoleKey = string

/**
 * Module definition structure
 * (derived from ModuleMeta to keep legacy helpers working)
 */
export interface ModuleDefinition extends ModuleMeta {
  id: ModuleId
  permissions: RbacPermission[]
  routePath: string
}

const metaToDefinition = (meta: ModuleMeta): ModuleDefinition => ({
  ...meta,
  id: meta.key as ModuleId,
  permissions: meta.requiredPermissions,
  routePath: meta.rootRoute
})

const registry = ALL_MODULES.map(metaToDefinition)

/**
 * Module IDs - unique identifiers for each module in the system
 */
export const moduleIds = registry.map((module) => module.id) as ModuleId[]

/**
 * Mapping from module ID to the RBAC permissions it requires
 * This is used to:
 * 1. Check if a user has access to a module
 * 2. Determine which permissions to check when accessing module functionality
 * 3. Display in admin UI for policy configuration
 */
export const modulePermissionMap: Record<ModuleId, RbacPermission[]> = registry.reduce(
  (acc, module) => {
    acc[module.id] = module.permissions
    return acc
  },
  {} as Record<ModuleId, RbacPermission[]>
)

/**
 * Get all permissions for a module
 */
export const getModulePermissions = (moduleId: ModuleId): RbacPermission[] => {
  return modulePermissionMap[moduleId] ?? []
}

/**
 * Check if a permission belongs to a specific module
 */
export const isPermissionForModule = (permission: RbacPermission, moduleId: ModuleId): boolean => {
  return getModulePermissions(moduleId).includes(permission)
}

/**
 * Get module ID from a permission (reverse lookup)
 * Returns the first module that uses this permission
 */
export const getModuleIdFromPermission = (permission: RbacPermission): ModuleId | null => {
  for (const [moduleId, permissions] of Object.entries(modulePermissionMap)) {
    if (permissions.includes(permission)) {
      return moduleId as ModuleId
    }
  }
  return null
}

/**
 * Get all module definitions
 */
export const getModuleDefinitions = (): ModuleDefinition[] => registry

