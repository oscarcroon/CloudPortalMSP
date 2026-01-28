import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants } from '~~/server/database/schema'
import { logTenantAction } from '~~/server/utils/audit'
import { requireDistributorTemplateAccess } from '~~/server/utils/mspRoleTemplates'

/**
 * DELETE /api/admin/distributors/:id/msp-role-templates/:templateId
 * 
 * Delete a role template
 * Blocked if template has consumers (roles derived from it)
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

  // Check if template has consumers (roles derived from it)
  const [usageCount] = await db
    .select({
      count: sql<number>`count(*)`.as('count')
    })
    .from(mspRoles)
    .where(
      and(
        eq(mspRoles.sourceTemplateId, templateId),
        eq(mspRoles.roleKind, 'role')
      )
    )

  if (usageCount && usageCount.count > 0) {
    throw createError({
      statusCode: 400,
      message: `Kan inte ta bort mallen. Den används av ${usageCount.count} roll(er). Avpublicera istället.`
    })
  }

  // Get distributor info for audit log
  const [distributor] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, distributorId))
    .limit(1)

  // Delete template (cascade deletes permissions)
  await db.delete(mspRoles).where(eq(mspRoles.id, templateId))

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_template_deleted',
      distributorName: distributor?.name,
      templateKey: template.key,
      templateName: template.name
    },
    distributorId
  )

  return { success: true }
})
