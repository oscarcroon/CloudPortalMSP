import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { mspRoles, mspRolePermissions, tenants } from '~~/server/database/schema'
import { requireDistributorTemplateAccess } from '~~/server/utils/mspRoleTemplates'

/**
 * GET /api/admin/distributors/:id/msp-role-templates
 * 
 * List all role templates for a distributor tenant
 * Returns templates with their permissions grouped by module
 */
export default defineEventHandler(async (event) => {
  const distributorId = getRouterParam(event, 'id')

  if (!distributorId) {
    throw createError({ statusCode: 400, message: 'Distributor ID saknas' })
  }

  const auth = await requireDistributorTemplateAccess(event, distributorId)
  const db = getDb()

  // Get query params for filtering
  const query = getQuery(event)
  const includeUnpublished = query.includeUnpublished === 'true' || auth.user.isSuperAdmin

  // Build where clause
  const whereConditions = [
    eq(mspRoles.tenantId, distributorId),
    eq(mspRoles.roleKind, 'template')
  ]

  // Non-superadmin users only see published templates by default
  if (!includeUnpublished) {
    whereConditions.push(sql`${mspRoles.publishedAt} IS NOT NULL`)
  }

  // Fetch templates
  const templates = await db
    .select({
      id: mspRoles.id,
      key: mspRoles.key,
      name: mspRoles.name,
      description: mspRoles.description,
      publishedAt: mspRoles.publishedAt,
      templateVersion: mspRoles.templateVersion,
      createdBy: mspRoles.createdBy,
      createdAt: mspRoles.createdAt,
      updatedAt: mspRoles.updatedAt
    })
    .from(mspRoles)
    .where(and(...whereConditions))
    .orderBy(mspRoles.name)

  if (templates.length === 0) {
    return { templates: [] }
  }

  const templateIds = templates.map((t) => t.id)

  // Fetch permissions for all templates
  const permissions = await db
    .select({
      roleId: mspRolePermissions.roleId,
      moduleKey: mspRolePermissions.moduleKey,
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .where(inArray(mspRolePermissions.roleId, templateIds))

  // Group permissions by roleId
  const permissionsMap: Record<string, Array<{ moduleKey: string; permissionKey: string }>> = {}
  for (const perm of permissions) {
    if (!permissionsMap[perm.roleId]) {
      permissionsMap[perm.roleId] = []
    }
    permissionsMap[perm.roleId].push({
      moduleKey: perm.moduleKey,
      permissionKey: perm.permissionKey
    })
  }

  // Count usage (provider roles derived from each template)
  const usageCounts = await db
    .select({
      sourceTemplateId: mspRoles.sourceTemplateId,
      count: sql<number>`count(*)`.as('count')
    })
    .from(mspRoles)
    .where(
      and(
        inArray(mspRoles.sourceTemplateId, templateIds),
        eq(mspRoles.roleKind, 'role')
      )
    )
    .groupBy(mspRoles.sourceTemplateId)

  const usageCountMap: Record<string, number> = {}
  for (const uc of usageCounts) {
    if (uc.sourceTemplateId) {
      usageCountMap[uc.sourceTemplateId] = uc.count
    }
  }

  // Build response
  const result = templates.map((template) => {
    const templatePerms = permissionsMap[template.id] || []

    // Group permissions by module for UI display
    const permissionsByModule: Record<string, string[]> = {}
    for (const perm of templatePerms) {
      if (!permissionsByModule[perm.moduleKey]) {
        permissionsByModule[perm.moduleKey] = []
      }
      permissionsByModule[perm.moduleKey].push(perm.permissionKey)
    }

    return {
      id: template.id,
      key: template.key,
      name: template.name,
      description: template.description,
      isPublished: template.publishedAt !== null,
      publishedAt: template.publishedAt ? new Date(template.publishedAt).toISOString() : null,
      templateVersion: template.templateVersion,
      usageCount: usageCountMap[template.id] || 0,
      permissions: templatePerms,
      permissionsByModule,
      permissionCount: templatePerms.length,
      createdBy: template.createdBy,
      createdAt: template.createdAt ? new Date(template.createdAt).toISOString() : null,
      updatedAt: template.updatedAt ? new Date(template.updatedAt).toISOString() : null
    }
  })

  return { templates: result }
})
