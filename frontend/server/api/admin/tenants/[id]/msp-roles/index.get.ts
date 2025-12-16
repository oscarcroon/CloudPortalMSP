import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, inArray, sql, and, or } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants, tenantMemberMspRoles, modulePermissions } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')

  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }

  await requireTenantPermission(event, 'tenants:read', tenantId)

  const db = getDb()

  // Verify tenant exists
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  // Get all MSP roles for this tenant
  const roles = await db
    .select({
      id: mspRoles.id,
      key: mspRoles.key,
      name: mspRoles.name,
      description: mspRoles.description,
      isSystem: mspRoles.isSystem,
      createdAt: mspRoles.createdAt,
      updatedAt: mspRoles.updatedAt
    })
    .from(mspRoles)
    .where(eq(mspRoles.tenantId, tenantId))
    .orderBy(mspRoles.name)

  // Get permissions for each role
  const roleIds = roles.map((r) => r.id)
  const permissionsMap: Record<string, Array<{ moduleKey: string; permissionKey: string }>> = {}
  const usageCountMap: Record<string, number> = {}
  const removedCountMap: Record<string, number> = {}

  if (roleIds.length > 0) {
    // Get permissions
    const permissions = await db
      .select({
        roleId: mspRolePermissions.roleId,
        moduleKey: mspRolePermissions.moduleKey,
        permissionKey: mspRolePermissions.permissionKey
      })
      .from(mspRolePermissions)
      .where(inArray(mspRolePermissions.roleId, roleIds))

    // Group by roleId
    for (const perm of permissions) {
      if (!permissionsMap[perm.roleId]) {
        permissionsMap[perm.roleId] = []
      }
      permissionsMap[perm.roleId].push({
        moduleKey: perm.moduleKey,
        permissionKey: perm.permissionKey
      })
    }

    // Get usage counts (how many members have each role)
    const usageCounts = await db
      .select({
        roleId: tenantMemberMspRoles.roleId,
        count: sql<number>`count(*)`.as('count')
      })
      .from(tenantMemberMspRoles)
      .where(inArray(tenantMemberMspRoles.roleId, roleIds))
      .groupBy(tenantMemberMspRoles.roleId)

    for (const uc of usageCounts) {
      usageCountMap[uc.roleId] = uc.count
    }

    // Get removed permissions count (permissions that are marked as removed in registry)
    const removedPerms = await db
      .select({
        roleId: mspRolePermissions.roleId,
        count: sql<number>`count(*)`.as('count')
      })
      .from(mspRolePermissions)
      .innerJoin(modulePermissions, and(
        eq(mspRolePermissions.moduleKey, modulePermissions.moduleKey),
        eq(mspRolePermissions.permissionKey, modulePermissions.permissionKey)
      ))
      .where(
        and(
          inArray(mspRolePermissions.roleId, roleIds),
          or(
            eq(modulePermissions.isActive, false),
            eq(modulePermissions.status, 'removed')
          )
        )
      )
      .groupBy(mspRolePermissions.roleId)

    for (const rp of removedPerms) {
      removedCountMap[rp.roleId] = rp.count
    }
  }

  return {
    roles: roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: permissionsMap[role.id] || [],
      usageCount: usageCountMap[role.id] || 0,
      removedCount: removedCountMap[role.id] || 0,
      createdAt: role.createdAt ? new Date(role.createdAt).toISOString() : null,
      updatedAt: role.updatedAt ? new Date(role.updatedAt).toISOString() : null
    }))
  }
})
