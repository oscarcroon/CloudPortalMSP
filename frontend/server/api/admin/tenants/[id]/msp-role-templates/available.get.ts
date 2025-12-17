import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import {
  mspRoles,
  mspRolePermissions,
  tenants,
  distributorProviders
} from '~~/server/database/schema'
import { filterPermissionsByProviderAccess } from '~~/server/utils/mspRoleTemplates'

/**
 * GET /api/admin/tenants/:id/msp-role-templates/available
 * 
 * List all published templates available to a provider tenant
 * Returns templates from all linked distributors with availability info
 */
export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')

  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
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
      message: 'Endast providers kan använda mallar.'
    })
  }

  // Get all distributors linked to this provider
  const links = await db
    .select({
      distributorId: distributorProviders.distributorId
    })
    .from(distributorProviders)
    .where(eq(distributorProviders.providerId, tenantId))

  if (links.length === 0) {
    return { templates: [] }
  }

  const distributorIds = links.map((l) => l.distributorId)

  // Get distributor names
  const distributors = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(inArray(tenants.id, distributorIds))

  const distributorMap = new Map(distributors.map((d) => [d.id, d.name]))

  // Fetch all published templates from linked distributors
  const templates = await db
    .select({
      id: mspRoles.id,
      tenantId: mspRoles.tenantId,
      key: mspRoles.key,
      name: mspRoles.name,
      description: mspRoles.description,
      templateVersion: mspRoles.templateVersion,
      publishedAt: mspRoles.publishedAt,
      createdAt: mspRoles.createdAt
    })
    .from(mspRoles)
    .where(
      and(
        inArray(mspRoles.tenantId, distributorIds),
        eq(mspRoles.roleKind, 'template'),
        sql`${mspRoles.publishedAt} IS NOT NULL`
      )
    )
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

  // Build response with availability info for each template
  const result = await Promise.all(
    templates.map(async (template) => {
      const templatePerms = permissionsMap[template.id] || []

      // Check which permissions are available for this provider
      const { available, unavailable } = await filterPermissionsByProviderAccess(
        tenantId,
        templatePerms
      )

      // Group permissions by module for UI display
      const availableByModule: Record<string, string[]> = {}
      for (const perm of available) {
        if (!availableByModule[perm.moduleKey]) {
          availableByModule[perm.moduleKey] = []
        }
        availableByModule[perm.moduleKey].push(perm.permissionKey)
      }

      const unavailableByModule: Record<string, Array<{ permissionKey: string; reason: string }>> = {}
      for (const perm of unavailable) {
        if (!unavailableByModule[perm.moduleKey]) {
          unavailableByModule[perm.moduleKey] = []
        }
        unavailableByModule[perm.moduleKey].push({
          permissionKey: perm.permissionKey,
          reason: perm.reason
        })
      }

      return {
        id: template.id,
        key: template.key,
        name: template.name,
        description: template.description,
        templateVersion: template.templateVersion,
        distributorId: template.tenantId,
        distributorName: distributorMap.get(template.tenantId) || 'Unknown',
        publishedAt: template.publishedAt ? new Date(template.publishedAt).toISOString() : null,
        permissions: {
          total: templatePerms.length,
          available: available.length,
          unavailable: unavailable.length,
          availableList: available,
          unavailableList: unavailable,
          availableByModule,
          unavailableByModule
        },
        createdAt: template.createdAt ? new Date(template.createdAt).toISOString() : null
      }
    })
  )

  return { templates: result }
})
