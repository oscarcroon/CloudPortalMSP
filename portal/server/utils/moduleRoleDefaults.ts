import { eq } from 'drizzle-orm'
import { getDb } from './db'
import { roleModuleRoleMappings } from '../database/schema'
import type { ModuleId, ModuleRoleKey } from '~/constants/modules'
import type { RbacRole } from '~/constants/rbac'
import { rbacModuleRoleDefaults } from '~/constants/moduleRoleMappings'

const mapArray = <T>(values: Set<T>): T[] => Array.from(values)

export const getModuleRoleDefaultsMap = async (
  moduleId: ModuleId
): Promise<Map<RbacRole, ModuleRoleKey[]>> => {
  const db = getDb()
  const rows = await db
    .select({
      rbacRole: roleModuleRoleMappings.rbacRole,
      moduleRoleKey: roleModuleRoleMappings.moduleRoleKey
    })
    .from(roleModuleRoleMappings)
    .where(eq(roleModuleRoleMappings.moduleId, moduleId))

  const map = new Map<RbacRole, Set<ModuleRoleKey>>()
  const rolesWithCustomMappings = new Set<RbacRole>()

  for (const row of rows) {
    const rbacRole = row.rbacRole as RbacRole
    rolesWithCustomMappings.add(rbacRole)
    const current = map.get(rbacRole) ?? new Set<ModuleRoleKey>()
    current.add(row.moduleRoleKey as ModuleRoleKey)
    map.set(rbacRole, current)
  }

  for (const [rbacRole, defaults] of Object.entries(rbacModuleRoleDefaults) as Array<
    [RbacRole, Record<ModuleId, ModuleRoleKey[]>]
  >) {
    if (rolesWithCustomMappings.has(rbacRole)) {
      continue
    }
    const roleDefaults = defaults[moduleId]
    if (!roleDefaults || roleDefaults.length === 0) {
      continue
    }
    map.set(rbacRole, new Set(roleDefaults))
  }

  const result = new Map<RbacRole, ModuleRoleKey[]>()
  for (const [rbacRole, values] of map) {
    result.set(rbacRole, mapArray(values))
  }

  return result
}

export const createModuleRoleDefaultResolver = () => {
  const cache = new Map<ModuleId, Map<RbacRole, ModuleRoleKey[]>>()
  return async (moduleId: ModuleId, role: RbacRole): Promise<ModuleRoleKey[]> => {
    if (!cache.has(moduleId)) {
      cache.set(moduleId, await getModuleRoleDefaultsMap(moduleId))
    }
    const map = cache.get(moduleId)!
    return map.get(role)?.slice() ?? []
  }
}


