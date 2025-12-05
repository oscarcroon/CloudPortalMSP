import type { RbacPermission } from './rbac'

/**
 * Module IDs - unique identifiers for each module in the system
 */
export const moduleIds = [
  'cloudflare',
  'containers',
  'vms',
  'wordpress',
  'ncentral',
  'monitoring',
  'managed-server'
] as const

export type ModuleId = (typeof moduleIds)[number]

/**
 * Module categories for grouping modules in the UI
 */
export type ModuleCategory = 'dns' | 'infrastructure' | 'monitoring' | 'cms' | 'rmm' | 'admin'

export type ModuleVisibilityMode = 'everyone' | 'moduleRoles'

export type ModuleRoleKey = string

export interface ModuleRoleDefinition {
  key: ModuleRoleKey
  label: string
  description?: string
  capabilities?: {
    read?: boolean
    write?: boolean
    manage?: boolean
  }
}

/**
 * Module definition structure
 * Each module must define its ID, metadata, and which RBAC permissions it uses
 */
export interface ModuleDefinition {
  id: ModuleId
  name: string
  description: string
  category: ModuleCategory
  permissions: RbacPermission[]
  routePath: string
  icon: string
  badge?: string
  /**
   * Controls whether module visibility is RBAC-only or guarded by module-specific roles
   */
  visibilityMode?: ModuleVisibilityMode
  /**
   * Optional module-specific roles definition exposed in policy/admin UI
   */
  roles?: ModuleRoleDefinition[]
  /**
   * Default module roles that should have visibility when no policy overrides exist
   * - null => inherit/allow everyone with base permission
   * - [] => nobody sees the module by default
   * - ['dns-admin'] => only specific module roles see the module
   */
  defaultAllowedRoles?: ModuleRoleKey[] | null
}

/**
 * Mapping from module ID to the RBAC permissions it requires
 * This is used to:
 * 1. Check if a user has access to a module
 * 2. Determine which permissions to check when accessing module functionality
 * 3. Display in admin UI for policy configuration
 */
export const modulePermissionMap: Record<ModuleId, RbacPermission[]> = {
  cloudflare: ['cloudflare:read', 'cloudflare:write'],
  containers: ['containers:read', 'containers:write'],
  vms: ['vms:read', 'vms:write'],
  wordpress: ['wordpress:read', 'wordpress:write'],
  ncentral: ['org:read'], // nCentral uses basic org read for now
  monitoring: ['org:read'], // Monitoring uses basic org read for now
  'managed-server': ['org:read'] // Managed server uses basic org read for now
}

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

