import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, and } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants } from '~~/server/database/schema'
import { createId } from '@paralleldrive/cuid2'
import { ensureAuthState } from '~~/server/utils/session'
import { logTenantAction } from '~~/server/utils/audit'

// Helper to generate slug from name
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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

  // Get permissions
  const permissions = await db
    .select({
      moduleKey: mspRolePermissions.moduleKey,
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .where(eq(mspRolePermissions.roleId, roleId))

  // Generate new key
  const baseSlug = slugify(role.name)
  let newKey = `msp-${baseSlug}`
  
  // Ensure uniqueness
  let counter = 1
  let finalKey = newKey
  while (true) {
    const [existing] = await db
      .select()
      .from(mspRoles)
      .where(and(eq(mspRoles.tenantId, tenantId), eq(mspRoles.key, finalKey)))
      .limit(1)
    
    if (!existing) {
      newKey = finalKey
      break
    }
    finalKey = `${newKey}-${counter}`
    counter++
  }

  const newRoleId = createId()
  const now = new Date()

  // Create cloned role
  await db.insert(mspRoles).values({
    id: newRoleId,
    tenantId,
    key: newKey,
    name: `${role.name} (Kopia)`,
    description: role.description,
    isSystem: false,
    createdBy: auth.user.id,
    createdAt: now,
    updatedAt: now
  })

  // Copy permissions
  if (permissions.length > 0) {
    await db.insert(mspRolePermissions).values(
      permissions.map((perm) => ({
        roleId: newRoleId,
        moduleKey: perm.moduleKey,
        permissionKey: perm.permissionKey
      }))
    )
  }

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_role_cloned',
      tenantName: tenant.name,
      sourceRoleKey: role.key,
      sourceRoleName: role.name,
      newRoleKey: newKey,
      newRoleName: `${role.name} (Kopia)`,
      permissionCount: permissions.length
    },
    tenantId
  )

  // Return cloned role
  const [clonedRole] = await db
    .select()
    .from(mspRoles)
    .where(eq(mspRoles.id, newRoleId))
    .limit(1)

  if (!clonedRole) {
    throw createError({ statusCode: 500, message: 'Klonad roll kunde inte hittas.' })
  }

  return {
    role: {
      id: clonedRole.id,
      key: clonedRole.key,
      name: clonedRole.name,
      description: clonedRole.description,
      isSystem: clonedRole.isSystem,
      permissions: permissions.map((p) => ({
        moduleKey: p.moduleKey,
        permissionKey: p.permissionKey
      })),
      createdAt: clonedRole.createdAt ? new Date(clonedRole.createdAt).toISOString() : null,
      updatedAt: clonedRole.updatedAt ? new Date(clonedRole.updatedAt).toISOString() : null
    }
  }
})
