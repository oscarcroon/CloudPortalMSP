import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, and } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { mspRoles, tenants } from '~~/server/database/schema'
import { logTenantAction } from '~~/server/utils/audit'
import { requireDistributorTemplateAccess } from '~~/server/utils/mspRoleTemplates'

/**
 * POST /api/admin/distributors/:id/msp-role-templates/:templateId/unpublish
 * 
 * Unpublish a role template
 * Existing provider roles derived from this template will remain but cannot sync
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

  if (template.publishedAt === null) {
    throw createError({ statusCode: 400, message: 'Mallen är inte publicerad.' })
  }

  // Get distributor info for audit log
  const [distributor] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, distributorId))
    .limit(1)

  const now = new Date()

  // Update template to unpublished
  await db
    .update(mspRoles)
    .set({
      publishedAt: null,
      updatedAt: now
    })
    .where(eq(mspRoles.id, templateId))

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_template_unpublished',
      distributorName: distributor?.name,
      templateKey: template.key,
      templateName: template.name,
      templateVersion: template.templateVersion
    },
    distributorId
  )

  return {
    success: true,
    template: {
      id: template.id,
      key: template.key,
      name: template.name,
      isPublished: false,
      publishedAt: null,
      templateVersion: template.templateVersion
    }
  }
})
