import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants, distributorProviders } from '~~/server/database/schema'
import { createId } from '@paralleldrive/cuid2'
import { logTenantAction } from '~~/server/utils/audit'
import { requireDistributorTemplateAccess } from '~~/server/utils/mspRoleTemplates'

const promoteRoleSchema = z.object({
  providerTenantId: z.string().min(1),
  roleId: z.string().min(1),
  key: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional()
})

/**
 * POST /api/admin/distributors/:id/msp-role-templates/from-role
 * 
 * Promote a provider role to a distributor template
 * Creates an unpublished template copy of the provider role
 */
export default defineEventHandler(async (event) => {
  const distributorId = getRouterParam(event, 'id')

  if (!distributorId) {
    throw createError({ statusCode: 400, message: 'Distributor ID saknas' })
  }

  const auth = await requireDistributorTemplateAccess(event, distributorId)
  const db = getDb()

  // Parse and validate request body
  const body = await readBody(event)
  const payload = promoteRoleSchema.parse(body)

  // Verify provider tenant exists and is a provider
  const [providerTenant] = await db
    .select({ id: tenants.id, type: tenants.type, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, payload.providerTenantId))
    .limit(1)

  if (!providerTenant) {
    throw createError({ statusCode: 404, message: 'Provider kunde inte hittas.' })
  }

  if (providerTenant.type !== 'provider') {
    throw createError({
      statusCode: 400,
      message: 'Angiven tenant är inte en provider.'
    })
  }

  // Verify provider is linked to this distributor
  const [link] = await db
    .select({ id: distributorProviders.id })
    .from(distributorProviders)
    .where(
      and(
        eq(distributorProviders.distributorId, distributorId),
        eq(distributorProviders.providerId, payload.providerTenantId)
      )
    )
    .limit(1)

  if (!link) {
    throw createError({
      statusCode: 403,
      message: 'Providern är inte länkad till denna distributör.'
    })
  }

  // Fetch the provider role
  const [sourceRole] = await db
    .select()
    .from(mspRoles)
    .where(
      and(
        eq(mspRoles.id, payload.roleId),
        eq(mspRoles.tenantId, payload.providerTenantId),
        eq(mspRoles.roleKind, 'role')
      )
    )
    .limit(1)

  if (!sourceRole) {
    throw createError({ statusCode: 404, message: 'Rollen kunde inte hittas hos providern.' })
  }

  // Get source role permissions
  const sourcePermissions = await db
    .select({
      moduleKey: mspRolePermissions.moduleKey,
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .where(eq(mspRolePermissions.roleId, payload.roleId))

  // Generate template key and name
  let templateKey = payload.key || sourceRole.key.replace(/^msp-/, 'msp-template-')
  if (!templateKey.startsWith('msp-template-')) {
    templateKey = `msp-template-${templateKey}`
  }
  const templateName = payload.name || `${sourceRole.name} (Mall)`

  // Check if key already exists for this distributor
  const [existing] = await db
    .select({ id: mspRoles.id })
    .from(mspRoles)
    .where(
      and(
        eq(mspRoles.tenantId, distributorId),
        eq(mspRoles.key, templateKey)
      )
    )
    .limit(1)

  if (existing) {
    // Add suffix to make unique
    let suffix = 2
    let candidateKey = `${templateKey}-${suffix}`
    let keyExists = true
    while (keyExists) {
      const [existingCandidate] = await db
        .select({ id: mspRoles.id })
        .from(mspRoles)
        .where(
          and(
            eq(mspRoles.tenantId, distributorId),
            eq(mspRoles.key, candidateKey)
          )
        )
        .limit(1)
      if (!existingCandidate) {
        keyExists = false
        templateKey = candidateKey
      } else {
        suffix++
        candidateKey = `${templateKey}-${suffix}`
      }
    }
  }

  // Get distributor info for audit log
  const [distributor] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, distributorId))
    .limit(1)

  const templateId = createId()
  const now = new Date()

  // Create template (synchronous transaction for better-sqlite3)
  db.transaction((tx) => {
    // Insert template
    tx.insert(mspRoles).values({
      id: templateId,
      tenantId: distributorId,
      key: templateKey,
      name: templateName,
      description: sourceRole.description,
      roleKind: 'template',
      publishedAt: null, // Unpublished by default
      templateVersion: 1,
      createdBy: auth.user.id,
      createdAt: now,
      updatedAt: now
    }).run()

    // Copy permissions
    if (sourcePermissions.length > 0) {
      tx.insert(mspRolePermissions).values(
        sourcePermissions.map((perm) => ({
          roleId: templateId,
          moduleKey: perm.moduleKey,
          permissionKey: perm.permissionKey
        }))
      ).run()
    }
  })

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_role_promoted_to_template',
      distributorName: distributor?.name,
      sourceProviderTenantId: payload.providerTenantId,
      sourceProviderName: providerTenant.name,
      sourceRoleId: payload.roleId,
      sourceRoleName: sourceRole.name,
      newTemplateId: templateId,
      newTemplateKey: templateKey,
      newTemplateName: templateName,
      permissionCount: sourcePermissions.length
    },
    distributorId
  )

  return {
    template: {
      id: templateId,
      key: templateKey,
      name: templateName,
      description: sourceRole.description,
      isPublished: false,
      publishedAt: null,
      templateVersion: 1,
      permissions: sourcePermissions,
      permissionCount: sourcePermissions.length,
      sourceRole: {
        id: sourceRole.id,
        key: sourceRole.key,
        name: sourceRole.name,
        providerTenantId: payload.providerTenantId,
        providerName: providerTenant.name
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  }
})
