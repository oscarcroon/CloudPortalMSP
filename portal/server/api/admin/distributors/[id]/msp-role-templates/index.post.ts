import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants } from '~~/server/database/schema'
import { createId } from '@paralleldrive/cuid2'
import { logTenantAction } from '~~/server/utils/audit'
import {
  requireDistributorTemplateAccess,
  validatePermissionsAgainstRegistry
} from '~~/server/utils/mspRoleTemplates'

const createTemplateSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  permissions: z
    .array(
      z.object({
        moduleKey: z.string(),
        permissionKey: z.string()
      })
    )
    .default([])
})

/**
 * POST /api/admin/distributors/:id/msp-role-templates
 * 
 * Create a new role template for a distributor
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
  const payload = createTemplateSchema.parse(body)

  // Ensure key has proper prefix
  let templateKey = payload.key
  if (!templateKey.startsWith('msp-template-')) {
    templateKey = `msp-template-${templateKey}`
  }

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
    throw createError({
      statusCode: 400,
      message: `En mall med nyckeln "${templateKey}" finns redan för denna distributör.`
    })
  }

  // Validate permissions against registry
  if (payload.permissions.length > 0) {
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

  const templateId = createId()
  const now = new Date()

  // Create template (transaction)
  await db.transaction(async (tx) => {
    // Insert template
    await tx.insert(mspRoles).values({
      id: templateId,
      tenantId: distributorId,
      key: templateKey,
      name: payload.name,
      description: payload.description || null,
      roleKind: 'template',
      publishedAt: null, // Unpublished by default
      templateVersion: 1,
      createdBy: auth.user.id,
      createdAt: now,
      updatedAt: now
    })

    // Insert permissions
    if (payload.permissions.length > 0) {
      await tx.insert(mspRolePermissions).values(
        payload.permissions.map((perm) => ({
          roleId: templateId,
          moduleKey: perm.moduleKey,
          permissionKey: perm.permissionKey
        }))
      )
    }
  })

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_template_created',
      distributorName: distributor?.name,
      templateKey,
      templateName: payload.name,
      permissionCount: payload.permissions.length
    },
    distributorId
  )

  // Fetch and return created template
  const [createdTemplate] = await db
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
      id: createdTemplate.id,
      key: createdTemplate.key,
      name: createdTemplate.name,
      description: createdTemplate.description,
      isPublished: false,
      publishedAt: null,
      templateVersion: createdTemplate.templateVersion,
      permissions,
      permissionCount: permissions.length,
      createdAt: createdTemplate.createdAt ? new Date(createdTemplate.createdAt).toISOString() : null,
      updatedAt: createdTemplate.updatedAt ? new Date(createdTemplate.updatedAt).toISOString() : null
    }
  }
})
