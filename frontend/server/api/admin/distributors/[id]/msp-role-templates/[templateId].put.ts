import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants } from '~~/server/database/schema'
import { logTenantAction } from '~~/server/utils/audit'
import {
  requireDistributorTemplateAccess,
  validatePermissionsAgainstRegistry
} from '~~/server/utils/mspRoleTemplates'

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  permissions: z
    .array(
      z.object({
        moduleKey: z.string(),
        permissionKey: z.string()
      })
    )
    .optional()
})

/**
 * PUT /api/admin/distributors/:id/msp-role-templates/:templateId
 * 
 * Update an existing role template
 * If template is published, bumps templateVersion
 */
export default defineEventHandler(async (event) => {
  const distributorId = getRouterParam(event, 'id')
  const templateId = getRouterParam(event, 'templateId')

  if (!distributorId) {
    throw createError({ statusCode: 400, message: 'Distributor ID saknas' })
  }

  if (!templateId) {
    throw createError({ statusCode: 400, message: 'Template ID saknas' })
  }

  const auth = await requireDistributorTemplateAccess(event, distributorId)
  const db = getDb()

  // Fetch existing template
  const [template] = await db
    .select()
    .from(mspRoles)
    .where(
      and(
        eq(mspRoles.id, templateId),
        eq(mspRoles.tenantId, distributorId),
        eq(mspRoles.roleKind, 'template')
      )
    )
    .limit(1)

  if (!template) {
    throw createError({ statusCode: 404, message: 'Mall kunde inte hittas.' })
  }

  // Parse and validate request body
  const body = await readBody(event)
  const payload = updateTemplateSchema.parse(body)

  // Validate permissions if provided
  if (payload.permissions && payload.permissions.length > 0) {
    const validation = await validatePermissionsAgainstRegistry(payload.permissions, {
      requireActive: true
    })

    if (validation.invalid.length > 0) {
      const invalidPerms = validation.invalid
        .map((p) => `${p.moduleKey}:${p.permissionKey} (${p.reason})`)
        .join(', ')
      throw createError({
        statusCode: 400,
        message: `Ogiltiga behörigheter: ${invalidPerms}`
      })
    }
  }

  // Get distributor info for audit log
  const [distributor] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, distributorId))
    .limit(1)

  const now = new Date()
  const isPublished = template.publishedAt !== null
  const newVersion = isPublished ? template.templateVersion + 1 : template.templateVersion

  // Update template (transaction)
  await db.transaction(async (tx) => {
    // Update template fields
    const updateData: Record<string, any> = {
      updatedAt: now
    }

    if (payload.name !== undefined) {
      updateData.name = payload.name
    }

    if (payload.description !== undefined) {
      updateData.description = payload.description
    }

    // Bump version if published and permissions changed
    if (isPublished && payload.permissions !== undefined) {
      updateData.templateVersion = newVersion
    }

    await tx
      .update(mspRoles)
      .set(updateData)
      .where(eq(mspRoles.id, templateId))

    // Update permissions if provided
    if (payload.permissions !== undefined) {
      // Delete existing permissions
      await tx
        .delete(mspRolePermissions)
        .where(eq(mspRolePermissions.roleId, templateId))

      // Insert new permissions
      if (payload.permissions.length > 0) {
        await tx.insert(mspRolePermissions).values(
          payload.permissions.map((perm) => ({
            roleId: templateId,
            moduleKey: perm.moduleKey,
            permissionKey: perm.permissionKey
          }))
        )
      }
    }
  })

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_template_updated',
      distributorName: distributor?.name,
      templateKey: template.key,
      templateName: payload.name || template.name,
      versionBumped: isPublished && payload.permissions !== undefined,
      newVersion: newVersion,
      permissionCount: payload.permissions?.length
    },
    distributorId
  )

  // Fetch and return updated template
  const [updatedTemplate] = await db
    .select()
    .from(mspRoles)
    .where(eq(mspRoles.id, templateId))
    .limit(1)

  const permissions = await db
    .select({
      moduleKey: mspRolePermissions.moduleKey,
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .where(eq(mspRolePermissions.roleId, templateId))

  return {
    template: {
      id: updatedTemplate.id,
      key: updatedTemplate.key,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      isPublished: updatedTemplate.publishedAt !== null,
      publishedAt: updatedTemplate.publishedAt
        ? new Date(updatedTemplate.publishedAt).toISOString()
        : null,
      templateVersion: updatedTemplate.templateVersion,
      permissions,
      permissionCount: permissions.length,
      createdAt: updatedTemplate.createdAt
        ? new Date(updatedTemplate.createdAt).toISOString()
        : null,
      updatedAt: updatedTemplate.updatedAt
        ? new Date(updatedTemplate.updatedAt).toISOString()
        : null
    }
  }
})
