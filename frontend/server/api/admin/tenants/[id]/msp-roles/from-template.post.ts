import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import {
  mspRoles,
  mspRolePermissions,
  tenants,
  distributorProviders
} from '~~/server/database/schema'
import { createId } from '@paralleldrive/cuid2'
import { logTenantAction } from '~~/server/utils/audit'
import { ensureAuthState } from '~~/server/utils/session'
import {
  validatePermissionsAgainstRegistry,
  filterPermissionsByProviderAccess,
  calculatePermissionsFingerprint,
  generateUniqueKey
} from '~~/server/utils/mspRoleTemplates'

const fromTemplateSchema = z.object({
  templateId: z.string().min(1),
  key: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  overwriteIfExists: z.boolean().default(false)
})

/**
 * POST /api/admin/tenants/:id/msp-roles/from-template
 * 
 * Create a provider role from a distributor template
 * Copies permissions (excluding unavailable ones) and sets sync metadata
 */
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
  const [tenant] = await db
    .select({ id: tenants.id, type: tenants.type, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  if (tenant.type !== 'provider') {
    throw createError({
      statusCode: 400,
      message: 'Endast providers kan skapa roller från mallar.'
    })
  }

  // Parse and validate request body
  const body = await readBody(event)
  const payload = fromTemplateSchema.parse(body)

  // Fetch the template
  const [template] = await db
    .select()
    .from(mspRoles)
    .where(
      and(
        eq(mspRoles.id, payload.templateId),
        eq(mspRoles.roleKind, 'template')
      )
    )
    .limit(1)

  if (!template) {
    throw createError({ statusCode: 404, message: 'Mall kunde inte hittas.' })
  }

  // Verify template is published (or user is superadmin)
  if (template.publishedAt === null && !auth.user.isSuperAdmin) {
    throw createError({
      statusCode: 400,
      message: 'Mallen är inte publicerad.'
    })
  }

  // Verify provider is linked to the template's distributor
  const [link] = await db
    .select({ id: distributorProviders.id })
    .from(distributorProviders)
    .where(
      and(
        eq(distributorProviders.distributorId, template.tenantId),
        eq(distributorProviders.providerId, tenantId)
      )
    )
    .limit(1)

  if (!link && !auth.user.isSuperAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Providern är inte länkad till mallens distributör.'
    })
  }

  // Fetch template permissions
  const templatePermissions = await db
    .select({
      moduleKey: mspRolePermissions.moduleKey,
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .where(eq(mspRolePermissions.roleId, payload.templateId))

  // Validate permissions against registry
  const registryValidation = await validatePermissionsAgainstRegistry(templatePermissions, {
    requireActive: true
  })

  // Filter by provider access
  const { available: accessiblePerms, unavailable: inaccessiblePerms } =
    await filterPermissionsByProviderAccess(tenantId, registryValidation.valid)

  // Combined unavailable (registry invalid + inaccessible)
  const totalSkipped = registryValidation.invalid.length + inaccessiblePerms.length

  // Generate role key
  let roleKey = payload.key || template.key.replace(/^msp-template-/, 'msp-')
  if (!roleKey.startsWith('msp-')) {
    roleKey = `msp-${roleKey}`
  }

  // Get existing keys for this tenant
  const existingRoles = await db
    .select({ key: mspRoles.key })
    .from(mspRoles)
    .where(eq(mspRoles.tenantId, tenantId))

  const existingKeys = existingRoles.map((r) => r.key)

  // Check if key exists
  const keyExists = existingKeys.includes(roleKey)
  let existingRoleId: string | null = null
  let isUpdate = false

  if (keyExists) {
    if (payload.overwriteIfExists) {
      // Find the existing role to update
      const [existingRole] = await db
        .select({ id: mspRoles.id })
        .from(mspRoles)
        .where(
          and(
            eq(mspRoles.tenantId, tenantId),
            eq(mspRoles.key, roleKey)
          )
        )
        .limit(1)

      if (existingRole) {
        existingRoleId = existingRole.id
        isUpdate = true
      }
    } else {
      // Generate unique key with suffix
      roleKey = generateUniqueKey(roleKey, existingKeys)
    }
  }

  const roleName = payload.name || template.name.replace(/ \(Mall\)$/, '')
  const now = new Date()
  const fingerprint = calculatePermissionsFingerprint(accessiblePerms)

  let roleId: string

  if (isUpdate && existingRoleId) {
    // Update existing role
    roleId = existingRoleId

    // Use synchronous transaction (better-sqlite3 requirement)
    db.transaction((tx) => {
      // Update role metadata
      tx.update(mspRoles)
        .set({
          name: roleName,
          description: template.description,
          sourceTemplateId: payload.templateId,
          sourceTemplateVersion: template.templateVersion,
          lastSyncedAt: now,
          permissionsFingerprint: fingerprint,
          updatedAt: now
        })
        .where(eq(mspRoles.id, roleId))
        .run()

      // Delete existing permissions
      tx.delete(mspRolePermissions)
        .where(eq(mspRolePermissions.roleId, roleId))
        .run()

      // Insert new permissions
      if (accessiblePerms.length > 0) {
        tx.insert(mspRolePermissions).values(
          accessiblePerms.map((perm) => ({
            roleId,
            moduleKey: perm.moduleKey,
            permissionKey: perm.permissionKey
          }))
        ).run()
      }
    })
  } else {
    // Create new role
    roleId = createId()

    // Use synchronous transaction (better-sqlite3 requirement)
    db.transaction((tx) => {
      // Insert role
      tx.insert(mspRoles).values({
        id: roleId,
        tenantId,
        key: roleKey,
        name: roleName,
        description: template.description,
        roleKind: 'role',
        sourceTemplateId: payload.templateId,
        sourceTemplateVersion: template.templateVersion,
        lastSyncedAt: now,
        permissionsFingerprint: fingerprint,
        createdBy: auth.user.id,
        createdAt: now,
        updatedAt: now
      }).run()

      // Insert permissions
      if (accessiblePerms.length > 0) {
        tx.insert(mspRolePermissions).values(
          accessiblePerms.map((perm) => ({
            roleId,
            moduleKey: perm.moduleKey,
            permissionKey: perm.permissionKey
          }))
        ).run()
      }
    })
  }

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: isUpdate ? 'msp_role_updated_from_template' : 'msp_role_created_from_template',
      tenantName: tenant.name,
      templateId: payload.templateId,
      templateKey: template.key,
      templateName: template.name,
      templateVersion: template.templateVersion,
      roleId,
      roleKey,
      roleName,
      permissionCount: accessiblePerms.length,
      skippedPermissions: totalSkipped
    },
    tenantId
  )

  // Fetch and return created/updated role
  const [createdRole] = await db
    .select()
    .from(mspRoles)
    .where(eq(mspRoles.id, roleId))
    .limit(1)

  return {
    role: {
      id: createdRole.id,
      key: createdRole.key,
      name: createdRole.name,
      description: createdRole.description,
      sourceTemplateId: createdRole.sourceTemplateId,
      sourceTemplateVersion: createdRole.sourceTemplateVersion,
      lastSyncedAt: createdRole.lastSyncedAt
        ? new Date(createdRole.lastSyncedAt).toISOString()
        : null,
      permissions: accessiblePerms,
      permissionCount: accessiblePerms.length,
      createdAt: createdRole.createdAt ? new Date(createdRole.createdAt).toISOString() : null,
      updatedAt: createdRole.updatedAt ? new Date(createdRole.updatedAt).toISOString() : null
    },
    template: {
      id: template.id,
      key: template.key,
      name: template.name,
      templateVersion: template.templateVersion
    },
    summary: {
      isUpdate,
      permissionsApplied: accessiblePerms.length,
      permissionsSkipped: totalSkipped,
      skippedDetails: {
        registryInvalid: registryValidation.invalid,
        providerInaccessible: inaccessiblePerms
      }
    }
  }
})
