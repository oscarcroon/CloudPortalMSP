/**
 * GET /api/organizations/{orgId}/groups/{groupId}/permissions
 * 
 * Returns all module permissions for a specific organization group.
 * Used by the group permissions management UI.
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroups, orgGroupModulePermissions } from '~~/server/database/schema'
import { getAllRegistryModules } from '~~/server/modules/registry'
import { getOrganizationModulesStatus } from '~~/server/utils/modulePolicy'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const groupId = getRouterParam(event, 'groupId')

  if (!orgId || !groupId) {
    throw createError({ statusCode: 400, message: 'Missing organization or group ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const db = getDb()

  // Verify group exists and belongs to this org
  const [group] = await db
    .select({
      id: orgGroups.id,
      name: orgGroups.name,
      slug: orgGroups.slug,
      description: orgGroups.description
    })
    .from(orgGroups)
    .where(and(eq(orgGroups.id, groupId), eq(orgGroups.organizationId, orgId)))
    .limit(1)

  if (!group) {
    throw createError({ statusCode: 404, message: 'Group not found' })
  }

  // Get all permissions for this group
  const permissions = await db
    .select({
      id: orgGroupModulePermissions.id,
      moduleKey: orgGroupModulePermissions.moduleKey,
      permissionKey: orgGroupModulePermissions.permissionKey,
      effect: orgGroupModulePermissions.effect
    })
    .from(orgGroupModulePermissions)
    .where(
      and(
        eq(orgGroupModulePermissions.organizationId, orgId),
        eq(orgGroupModulePermissions.groupId, groupId)
      )
    )

  // Get all modules from registry
  const registryModules = getAllRegistryModules()

  // Get current module status for the org (to show which modules are enabled)
  const moduleStatuses = await getOrganizationModulesStatus(orgId)
  const enabledModuleIds = new Set(
    moduleStatuses
      .filter(m => m.effectiveEnabled && !m.effectiveDisabled)
      .map(m => m.key)
  )

  // Build permission map: moduleKey -> permissionKey -> effect
  const permissionMap: Record<string, Record<string, 'grant' | 'deny'>> = {}
  for (const perm of permissions) {
    if (!permissionMap[perm.moduleKey]) {
      permissionMap[perm.moduleKey] = {}
    }
    permissionMap[perm.moduleKey]![perm.permissionKey] = perm.effect
  }

  // Map registry modules with their permissions and current group effects
  const modules = registryModules.map(module => ({
    id: module.id,
    name: module.name,
    description: module.description,
    category: module.category,
    icon: module.icon,
    riskClass: module.riskClass,
    isEnabled: enabledModuleIds.has(module.id),
    permissions: module.permissions.map(p => ({
      key: p.key,
      description: p.description,
      label: p.label,
      action: p.action,
      // Current effect for this group (undefined = inherit/no explicit setting)
      effect: permissionMap[module.id]?.[p.key] ?? null
    }))
  }))

  return {
    organizationId: orgId,
    group: {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description
    },
    modules
  }
})
