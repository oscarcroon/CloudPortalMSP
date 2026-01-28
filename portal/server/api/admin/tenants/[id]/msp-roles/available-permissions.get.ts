import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { modulePermissions, modules } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'

export interface AvailablePermission {
  moduleKey: string
  moduleName: string
  permissions: Array<{
    key: string
    description?: string | null
    isActive: boolean
    status: 'active' | 'deprecated' | 'removed'
  }>
}

export default defineEventHandler(async (event): Promise<{ permissions: AvailablePermission[] }> => {
  const tenantId = getRouterParam(event, 'id')

  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }

  await requireTenantPermission(event, 'tenants:read', tenantId)

  const db = getDb()

  // Get all permissions from registry (source of truth)
  const allPermissions = await db
    .select({
      moduleKey: modulePermissions.moduleKey,
      permissionKey: modulePermissions.permissionKey,
      description: modulePermissions.description,
      isActive: modulePermissions.isActive,
      status: modulePermissions.status
    })
    .from(modulePermissions)

  // Get module names
  const allModules = await db.select({
    key: modules.key,
    name: modules.name
  }).from(modules)

  const moduleNameMap = new Map(allModules.map((m) => [m.key, m.name]))

  // Group permissions by module
  const permissionsMap = new Map<string, AvailablePermission>()

  for (const perm of allPermissions) {
    if (!permissionsMap.has(perm.moduleKey)) {
      permissionsMap.set(perm.moduleKey, {
        moduleKey: perm.moduleKey,
        moduleName: moduleNameMap.get(perm.moduleKey) || perm.moduleKey,
        permissions: []
      })
    }

    const module = permissionsMap.get(perm.moduleKey)!
    module.permissions.push({
      key: perm.permissionKey,
      description: perm.description,
      isActive: perm.isActive ?? true,
      status: (perm.status as 'active' | 'deprecated' | 'removed') || 'active'
    })
  }

  // Sort permissions within each module
  for (const module of permissionsMap.values()) {
    module.permissions.sort((a, b) => a.key.localeCompare(b.key))
  }

  return {
    permissions: Array.from(permissionsMap.values()).sort((a, b) => a.moduleName.localeCompare(b.moduleName))
  }
})
