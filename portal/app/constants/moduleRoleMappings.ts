import type { ModuleId, ModuleRoleKey } from './modules'
import type { RbacRole } from './rbac'

export type ModuleRoleDefaults = Partial<Record<ModuleId, ModuleRoleKey[]>>

export const rbacModuleRoleDefaults: Record<RbacRole, ModuleRoleDefaults> = {
  owner: {
    cloudflare: ['dns-admin', 'dns-reader'],
    vms: ['vms-admin', 'vms-reader']
  },
  admin: {
    cloudflare: ['dns-admin', 'dns-reader'],
    vms: ['vms-admin', 'vms-reader']
  },
  operator: {
    cloudflare: ['dns-admin'],
    vms: ['vms-admin']
  },
  member: {
    cloudflare: ['dns-reader'],
    vms: ['vms-reader']
  },
  viewer: {
    cloudflare: ['dns-reader'],
    vms: ['vms-reader']
  },
  support: {
    cloudflare: ['dns-reader'],
    vms: ['vms-reader']
  }
}

export const getDefaultModuleRolesFor = (
  role: RbacRole,
  moduleId: ModuleId
): ModuleRoleKey[] | null => {
  const defaults = rbacModuleRoleDefaults[role]
  if (!defaults) {
    return null
  }
  const roles = defaults[moduleId]
  return roles ? [...roles] : null
}

