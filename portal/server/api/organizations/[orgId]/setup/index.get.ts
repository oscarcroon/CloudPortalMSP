/**
 * GET /api/organizations/{orgId}/setup
 * 
 * Returns the setup status and available options for the organization setup wizard.
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizations, orgGroups } from '~~/server/database/schema'
import { getAllRegistryModules } from '~~/server/modules/registry'
import { ALL_TEMPLATES } from '~~/server/utils/orgRoleTemplates'
import { getOrganizationModulesStatus } from '~~/server/utils/modulePolicy'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  // Require org:manage permission for setup
  await requirePermission(event, 'org:manage', orgId)

  const db = getDb()

  // Get organization setup status
  const [org] = await db
    .select({
      setupStatus: organizations.setupStatus,
      setupCompletedAt: organizations.setupCompletedAt,
      defaultGroupId: organizations.defaultGroupId
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Get organization groups
  const groups = await db
    .select({
      id: orgGroups.id,
      name: orgGroups.name,
      slug: orgGroups.slug,
      description: orgGroups.description
    })
    .from(orgGroups)
    .where(eq(orgGroups.organizationId, orgId))

  // Get all modules from registry
  const registryModules = getAllRegistryModules()

  // Get current module status for the org (to check what's already enabled)
  const moduleStatuses = await getOrganizationModulesStatus(orgId)
  const enabledModuleIds = new Set(
    moduleStatuses
      .filter(m => m.effectiveEnabled && !m.effectiveDisabled)
      .map(m => m.key)
  )

  // Map registry modules to setup format
  const availableModules = registryModules.map(module => ({
    id: module.id,
    name: module.name,
    description: module.description,
    category: module.category,
    icon: module.icon,
    riskClass: module.riskClass,
    permissions: module.permissions.map(p => ({
      key: p.key,
      description: p.description,
      action: p.action
    })),
    // Check if already enabled
    currentlyEnabled: enabledModuleIds.has(module.id)
  }))

  // Map templates to simple format
  const templates = ALL_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description
  }))

  return {
    setupStatus: org.setupStatus,
    setupCompletedAt: org.setupCompletedAt,
    defaultGroupId: org.defaultGroupId,
    availableModules,
    templates,
    groups: groups.map(g => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      description: g.description ?? ''
    }))
  }
})
