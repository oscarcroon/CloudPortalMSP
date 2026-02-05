/**
 * POST /api/organizations/{orgId}/setup/apply-template
 * 
 * Applies a role template to the organization, creating org_group_module_permissions entries.
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroups, orgGroupModulePermissions, organizationModulePolicies } from '~~/server/database/schema'
import { getAllRegistryModules, getModulePermissionKeys } from '~~/server/modules/registry'
import { getOrgRoleTemplate, calculateGroupPermissions } from '~~/server/utils/orgRoleTemplates'
import type { OrgRoleTemplateId } from '~~/server/utils/orgRoleTemplates'

const bodySchema = z.object({
  templateId: z.enum(['standard', 'strict', 'msp'])
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const body = bodySchema.parse(await readBody(event))
  const template = getOrgRoleTemplate(body.templateId as OrgRoleTemplateId)

  if (!template) {
    throw createError({ statusCode: 400, message: `Unknown template: ${body.templateId}` })
  }

  const db = getDb()

  // Get organization groups
  const existingGroups = await db
    .select({
      id: orgGroups.id,
      slug: orgGroups.slug
    })
    .from(orgGroups)
    .where(eq(orgGroups.organizationId, orgId))

  const groupSlugToId = new Map(existingGroups.map(g => [g.slug, g.id]))

  // Get modules that are enabled for this org (not blocked)
  const enabledPolicies = await db
    .select({
      moduleId: organizationModulePolicies.moduleId,
      mode: organizationModulePolicies.mode,
      enabled: organizationModulePolicies.enabled
    })
    .from(organizationModulePolicies)
    .where(eq(organizationModulePolicies.organizationId, orgId))

  const enabledModuleIds = new Set(
    enabledPolicies
      .filter(p => p.mode !== 'blocked' && p.enabled !== false)
      .map(p => p.moduleId)
  )

  // Get registry modules that are enabled
  const allModules = getAllRegistryModules()
  const availableModules = allModules.filter(m => enabledModuleIds.has(m.id))

  // Calculate permissions for each group based on template
  const permissionsToInsert: Array<{
    id: string
    organizationId: string
    groupId: string
    moduleKey: string
    permissionKey: string
    effect: 'grant' | 'deny'
  }> = []

  for (const groupConfig of template.groups) {
    const groupId = groupSlugToId.get(groupConfig.slug)
    if (!groupId) {
      console.warn(`[apply-template] Group ${groupConfig.slug} not found for org ${orgId}`)
      continue
    }

    // Calculate permissions for this group
    const groupPermissions = calculateGroupPermissions(groupConfig, availableModules)

    // Create permission entries for each module
    for (const [moduleId, permKeys] of groupPermissions) {
      // Delete existing permissions for this group+module first
      await db
        .delete(orgGroupModulePermissions)
        .where(
          and(
            eq(orgGroupModulePermissions.organizationId, orgId),
            eq(orgGroupModulePermissions.groupId, groupId),
            eq(orgGroupModulePermissions.moduleKey, moduleId)
          )
        )

      // Add new grant entries
      for (const permKey of permKeys) {
        permissionsToInsert.push({
          id: createId(),
          organizationId: orgId,
          groupId,
          moduleKey: moduleId,
          permissionKey: permKey,
          effect: 'grant'
        })
      }
    }
  }

  // Batch insert permissions
  if (permissionsToInsert.length > 0) {
    // Insert in batches to avoid query size limits
    const BATCH_SIZE = 100
    for (let i = 0; i < permissionsToInsert.length; i += BATCH_SIZE) {
      const batch = permissionsToInsert.slice(i, i + BATCH_SIZE)
      await db.insert(orgGroupModulePermissions).values(batch)
    }
  }

  console.log(`[apply-template] Applied template ${body.templateId} to org ${orgId}: ${permissionsToInsert.length} permissions created`)

  return {
    success: true,
    templateId: body.templateId,
    permissionsCreated: permissionsToInsert.length
  }
})
