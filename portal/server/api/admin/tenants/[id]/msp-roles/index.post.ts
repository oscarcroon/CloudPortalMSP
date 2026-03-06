import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants, modulePermissions } from '~~/server/database/schema'
import { createId } from '@paralleldrive/cuid2'
import { ensureAuthState } from '~~/server/utils/session'
import { logTenantAction } from '~~/server/utils/audit'

const createMspRoleSchema = z.object({
  key: z.string().min(1).optional(), // Optional - will be generated from name if missing
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  permissions: z.array(
    z.object({
      moduleKey: z.string(),
      permissionKey: z.string()
    })
  ).default([])
})

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

  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  await requireTenantPermission(event, 'tenants:manage-members', tenantId)

  const db = getDb()

  // Verify tenant exists and is a provider
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  // Only providers can have MSP roles - distributors should use templates
  if (tenant.type !== 'provider') {
    throw createError({ 
      statusCode: 400, 
      message: 'MSP-roller kan endast skapas för leverantörer (providers). Distributörer använder rollmallar istället.' 
    })
  }

  const payload = createMspRoleSchema.parse(await readBody(event))

  // Generate key from name if not provided
  let roleKey = payload.key
  if (!roleKey || roleKey.trim() === '') {
    const slugified = slugify(payload.name)
    roleKey = `msp-${slugified}`
  } else {
    // Ensure key starts with "msp-" prefix
    if (!roleKey.startsWith('msp-')) {
      roleKey = `msp-${roleKey}`
    }
  }

  // Check if role key already exists for this tenant
  const [existing] = await db
    .select()
    .from(mspRoles)
    .where(and(eq(mspRoles.tenantId, tenantId), eq(mspRoles.key, roleKey)))
    .limit(1)

  if (existing) {
    throw createError({ statusCode: 400, message: `En roll med nyckeln "${roleKey}" finns redan för denna tenant.` })
  }

  const roleId = createId()
  const now = new Date()

  // Create role (explicitly set role_kind to 'role', not 'template')
  await db.insert(mspRoles).values({
    id: roleId,
    tenantId,
    key: roleKey,
    name: payload.name,
    description: payload.description || null,
    roleKind: 'role',
    createdBy: auth.user.id,
    createdAt: now,
    updatedAt: now
  })

  // Add permissions
  if (payload.permissions.length > 0) {
    await db.insert(mspRolePermissions).values(
      payload.permissions.map((perm) => ({
        roleId,
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
      action: 'msp_role_created',
      tenantName: tenant.name,
      roleKey: roleKey,
      roleName: payload.name,
      permissionCount: payload.permissions.length
    },
    tenantId
  )

  // Return created role
  const [createdRole] = await db
    .select()
    .from(mspRoles)
    .where(eq(mspRoles.id, roleId))
    .limit(1)

  if (!createdRole) {
    throw createError({ statusCode: 500, message: 'Skapad roll kunde inte hittas.' })
  }

  const permissions = await db
    .select({
      moduleKey: mspRolePermissions.moduleKey,
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .where(eq(mspRolePermissions.roleId, roleId))

  return {
    role: {
      id: createdRole.id,
      key: createdRole.key,
      name: createdRole.name,
      description: createdRole.description,
      permissions: permissions.map((p) => ({
        moduleKey: p.moduleKey,
        permissionKey: p.permissionKey
      })),
      createdAt: createdRole.createdAt ? new Date(createdRole.createdAt).toISOString() : null,
      updatedAt: createdRole.updatedAt ? new Date(createdRole.updatedAt).toISOString() : null
    }
  }
})
