import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants } from '~~/server/database/schema'
import { ensureAuthState } from '~~/server/utils/session'
import { logTenantAction } from '~~/server/utils/audit'

const updateMspRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  permissions: z.array(
    z.object({
      moduleKey: z.string(),
      permissionKey: z.string()
    })
  ).optional()
})

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

  // Block editing system roles (except name/description)
  if (role.isSystem && payload.permissions !== undefined) {
    throw createError({
      statusCode: 403,
      message: 'Kan inte ändra permissions för systemroller. Klona rollen för att skapa en anpassad version.'
    })
  }

  const payload = updateMspRoleSchema.parse(await readBody(event))
  const updates: Partial<typeof role> = {
    updatedAt: new Date()
  }

  if (payload.name !== undefined) {
    updates.name = payload.name
  }
  if (payload.description !== undefined) {
    updates.description = payload.description
  }

  // Validate permissions if provided
  if (payload.permissions !== undefined) {
    // Validate all permissions exist in registry
    for (const perm of payload.permissions) {
      const [registryPerm] = await db
        .select()
        .from(modulePermissions)
        .where(
          and(
            eq(modulePermissions.moduleKey, perm.moduleKey),
            eq(modulePermissions.permissionKey, perm.permissionKey)
          )
        )
        .limit(1)

      if (!registryPerm) {
        throw createError({
          statusCode: 400,
          message: `Permission "${perm.permissionKey}" för modul "${perm.moduleKey}" finns inte i registry.`
        })
      }
    }
  }

  // Update role
  if (Object.keys(updates).length > 1) {
    // More than just updatedAt
    await db.update(mspRoles).set(updates).where(eq(mspRoles.id, roleId))
  }

  // Update permissions if provided (atomically in transaction)
  if (payload.permissions !== undefined) {
    const isSqlite =
      (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

    if (isSqlite) {
      await db.transaction((tx) => {
        // Delete existing permissions
        tx.delete(mspRolePermissions).where(eq(mspRolePermissions.roleId, roleId)).run()

        // Insert new permissions
        if (payload.permissions && payload.permissions.length > 0) {
          tx.insert(mspRolePermissions).values(
            payload.permissions.map((perm) => ({
              roleId,
              moduleKey: perm.moduleKey,
              permissionKey: perm.permissionKey
            }))
          ).run()
        }
      })
    } else {
      // MySQL transaction
      await (db as any).transaction(async (tx: any) => {
        // Delete existing permissions
        await tx.delete(mspRolePermissions).where(eq(mspRolePermissions.roleId, roleId))

        // Insert new permissions
        if (payload.permissions && payload.permissions.length > 0) {
          await tx.insert(mspRolePermissions).values(
            payload.permissions.map((perm: any) => ({
              roleId,
              moduleKey: perm.moduleKey,
              permissionKey: perm.permissionKey
            }))
          )
        }
      })
    }
  }

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_role_updated',
      tenantName: tenant.name,
      roleKey: role.key,
      roleName: role.name,
      permissionCount: payload.permissions?.length ?? 'unchanged'
    },
    tenantId
  )

  // Return updated role
  const [updatedRole] = await db
    .select()
    .from(mspRoles)
    .where(eq(mspRoles.id, roleId))
    .limit(1)

  const permissions = await db
    .select({
      moduleKey: mspRolePermissions.moduleKey,
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .where(eq(mspRolePermissions.roleId, roleId))

  return {
    role: {
      id: updatedRole.id,
      key: updatedRole.key,
      name: updatedRole.name,
      description: updatedRole.description,
      permissions: permissions.map((p) => ({
        moduleKey: p.moduleKey,
        permissionKey: p.permissionKey
      })),
      createdAt: updatedRole.createdAt ? new Date(updatedRole.createdAt).toISOString() : null,
      updatedAt: updatedRole.updatedAt ? new Date(updatedRole.updatedAt).toISOString() : null
    }
  }
})
