import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, and, sql } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants, tenantMemberMspRoles } from '~~/server/database/schema'
import { ensureAuthState } from '~~/server/utils/session'
import { logTenantAction } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const roleId = getRouterParam(event, 'roleId')

  if (!tenantId || !roleId) {
    throw createError({ statusCode: 400, message: 'Tenant ID och Role ID krävs.' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  await requireTenantPermission(event, 'tenants:manage-members', tenantId)

  const db = getDb()

  // Verify tenant exists
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  // Verify role exists and belongs to tenant
  const [role] = await db
    .select()
    .from(mspRoles)
    .where(and(eq(mspRoles.id, roleId), eq(mspRoles.tenantId, tenantId)))
    .limit(1)

  if (!role) {
    throw createError({ statusCode: 404, message: 'MSP-rollen kunde inte hittas.' })
  }

  // Block deletion of system roles
  if (role.isSystem) {
    throw createError({
      statusCode: 403,
      message: 'Kan inte ta bort systemroller. Klona rollen för att skapa en anpassad version.'
    })
  }

  // Check if role is in use (assigned to any members)
  const usageCount = await db
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(tenantMemberMspRoles)
    .where(eq(tenantMemberMspRoles.roleId, roleId))

  const count = usageCount[0]?.count ?? 0
  if (count > 0) {
    throw createError({
      statusCode: 400,
      message: `Kan inte ta bort rollen eftersom den är tilldelad till ${count} medlemmar. Ta bort rollen från alla medlemmar först.`
    })
  }

  // Delete permissions first (cascade should handle this, but being explicit)
  await db.delete(mspRolePermissions).where(eq(mspRolePermissions.roleId, roleId))

  // Delete role
  await db.delete(mspRoles).where(eq(mspRoles.id, roleId))

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_role_deleted',
      tenantName: tenant.name,
      roleKey: role.key,
      roleName: role.name
    },
    tenantId
  )

  return { success: true }
})
