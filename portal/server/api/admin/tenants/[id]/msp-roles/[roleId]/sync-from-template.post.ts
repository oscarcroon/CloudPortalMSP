import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants } from '~~/server/database/schema'
import { logTenantAction } from '~~/server/utils/audit'
import { ensureAuthState } from '~~/server/utils/session'
import {
  validatePermissionsAgainstRegistry,
  filterPermissionsByProviderAccess,
  calculatePermissionsFingerprint,
  computePermissionsDiff
} from '~~/server/utils/mspRoleTemplates'

const syncSchema = z.object({
  mode: z.enum(['dry-run', 'apply']),
  strategy: z.enum(['merge', 'replace']).default('merge'),
  force: z.boolean().default(false)
})

/**
 * POST /api/admin/tenants/:tenantId/msp-roles/:roleId/sync-from-template
 * 
 * Sync/upgrade a provider role from its source template
 * Supports dry-run mode and merge/replace strategies
 */
export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const roleId = getRouterParam(event, 'roleId')

  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }

  if (!roleId) {
    throw createError({ statusCode: 400, message: 'Role ID saknas' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  await requireTenantPermission(event, 'tenants:manage-members', tenantId)

  const db = getDb()

  // Parse and validate request body
  const body = await readBody(event)
  const payload = syncSchema.parse(body)

  // Fetch the role
  const [role] = await db
    .select()
    .from(mspRoles)
    .where(
      and(
        eq(mspRoles.id, roleId),
        eq(mspRoles.tenantId, tenantId),
        eq(mspRoles.roleKind, 'role')
      )
    )
    .limit(1)

  if (!role) {
    throw createError({ statusCode: 404, message: 'Roll kunde inte hittas.' })
  }

  // Check that role has a source template
  if (!role.sourceTemplateId) {
    throw createError({
      statusCode: 400,
      message: 'Rollen är inte skapad från en mall.'
    })
  }

  // Fetch the template
  const [template] = await db
    .select()
    .from(mspRoles)
    .where(
      and(
        eq(mspRoles.id, role.sourceTemplateId),
        eq(mspRoles.roleKind, 'template')
      )
    )
    .limit(1)

  if (!template) {
    throw createError({
      statusCode: 404,
      message: 'Källmallen kunde inte hittas. Den kan ha tagits bort.'
    })
  }

  // Check if template is still published (warn if not)
  const templateUnpublished = template.publishedAt === null

  // Fetch current role permissions
  const currentPermissions = await db
    .select({
      moduleKey: mspRolePermissions.moduleKey,
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .where(eq(mspRolePermissions.roleId, roleId))

  // Fetch template permissions
  const templatePermissions = await db
    .select({
      moduleKey: mspRolePermissions.moduleKey,
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .where(eq(mspRolePermissions.roleId, role.sourceTemplateId))

  // Validate template permissions against registry
  const registryValidation = await validatePermissionsAgainstRegistry(templatePermissions, {
    requireActive: true
  })

  // Filter by provider access
  const { available: accessibleTemplatePerms, unavailable: inaccessiblePerms } =
    await filterPermissionsByProviderAccess(tenantId, registryValidation.valid)

  // Check if role has been modified locally since last sync
  const currentFingerprint = calculatePermissionsFingerprint(currentPermissions)
  const storedFingerprint = role.permissionsFingerprint
  const isModifiedLocally = storedFingerprint !== null && currentFingerprint !== storedFingerprint

  // If modified locally and not forcing, return 409
  if (isModifiedLocally && !payload.force && payload.mode === 'apply') {
    // Compute what changed locally
    const originalPermsFromTemplate = accessibleTemplatePerms // Approximation
    const localDiff = computePermissionsDiff(
      originalPermsFromTemplate,
      currentPermissions,
      'replace'
    )

    return {
      statusCode: 409,
      error: 'MODIFIED_LOCALLY',
      message: 'Rollen har modifierats lokalt sedan senaste synk. Använd force=true för att ignorera.',
      isModifiedLocally: true,
      localChanges: {
        added: localDiff.toRemove, // Perms in current but not in template
        removed: localDiff.toAdd // Perms in template but not in current
      },
      suggestion: 'Granska ändringarna och använd force=true om du vill skriva över.'
    }
  }

  // Compute diff based on strategy
  const diff = computePermissionsDiff(
    currentPermissions,
    accessibleTemplatePerms,
    payload.strategy
  )

  // Build response
  const skippedDetails = {
    registryInvalid: registryValidation.invalid,
    providerInaccessible: inaccessiblePerms
  }

  const syncResult = {
    mode: payload.mode,
    strategy: payload.strategy,
    template: {
      id: template.id,
      key: template.key,
      name: template.name,
      templateVersion: template.templateVersion,
      isPublished: !templateUnpublished
    },
    role: {
      id: role.id,
      key: role.key,
      name: role.name,
      currentVersion: role.sourceTemplateVersion
    },
    diff: {
      toAdd: diff.toAdd,
      toRemove: diff.toRemove,
      unchanged: diff.unchanged
    },
    skippedPerms: registryValidation.invalid.length + inaccessiblePerms.length,
    skippedDetails,
    willUpdateToVersion: template.templateVersion,
    isModifiedLocally,
    templateUnpublished
  }

  // If dry-run, return the diff without applying
  if (payload.mode === 'dry-run') {
    return syncResult
  }

  // Apply mode - execute the sync
  const now = new Date()

  await db.transaction(async (tx) => {
    // Remove permissions according to diff
    if (diff.toRemove.length > 0) {
      for (const perm of diff.toRemove) {
        await tx
          .delete(mspRolePermissions)
          .where(
            and(
              eq(mspRolePermissions.roleId, roleId),
              eq(mspRolePermissions.moduleKey, perm.moduleKey),
              eq(mspRolePermissions.permissionKey, perm.permissionKey)
            )
          )
      }
    }

    // Add permissions according to diff
    if (diff.toAdd.length > 0) {
      await tx.insert(mspRolePermissions).values(
        diff.toAdd.map((perm) => ({
          roleId,
          moduleKey: perm.moduleKey,
          permissionKey: perm.permissionKey
        }))
      )
    }

    // Compute new fingerprint after changes
    const newPerms = [
      ...diff.unchanged,
      ...diff.toAdd
    ]
    const newFingerprint = calculatePermissionsFingerprint(newPerms)

    // Update role sync metadata
    await tx
      .update(mspRoles)
      .set({
        sourceTemplateVersion: template.templateVersion,
        lastSyncedAt: now,
        permissionsFingerprint: newFingerprint,
        updatedAt: now
      })
      .where(eq(mspRoles.id, roleId))
  })

  // Get tenant name for audit
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_role_synced_from_template',
      tenantName: tenant?.name,
      roleId,
      roleKey: role.key,
      roleName: role.name,
      templateId: template.id,
      templateKey: template.key,
      templateName: template.name,
      strategy: payload.strategy,
      fromVersion: role.sourceTemplateVersion,
      toVersion: template.templateVersion,
      permissionsAdded: diff.toAdd.length,
      permissionsRemoved: diff.toRemove.length,
      permissionsSkipped: registryValidation.invalid.length + inaccessiblePerms.length,
      forced: payload.force && isModifiedLocally
    },
    tenantId
  )

  return {
    ...syncResult,
    applied: true,
    summary: {
      permissionsAdded: diff.toAdd.length,
      permissionsRemoved: diff.toRemove.length,
      permissionsUnchanged: diff.unchanged.length,
      permissionsSkipped: registryValidation.invalid.length + inaccessiblePerms.length
    }
  }
})
