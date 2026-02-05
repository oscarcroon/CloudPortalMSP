/**
 * PUT /api/organizations/{orgId}/groups/{groupId}/permissions
 * 
 * Updates module permissions for an organization group.
 * Supports setting grant/deny or removing (null) permissions.
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroups, orgGroupModulePermissions } from '~~/server/database/schema'
import { getRegistryModule } from '~~/server/modules/registry'
import { logOrganizationAction } from '~~/server/utils/audit'

const permissionUpdateSchema = z.object({
  permissions: z.array(
    z.object({
      moduleKey: z.string(),
      permissionKey: z.string(),
      effect: z.enum(['grant', 'deny']).nullable() // null = remove/inherit
    })
  )
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const groupId = getRouterParam(event, 'groupId')

  if (!orgId || !groupId) {
    throw createError({ statusCode: 400, message: 'Missing organization or group ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const body = await readBody(event)
  const parsed = permissionUpdateSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: parsed.error.flatten()
    })
  }

  const { permissions } = parsed.data
  const db = getDb()

  // Verify group exists and belongs to this org
  const [group] = await db
    .select({ id: orgGroups.id, name: orgGroups.name })
    .from(orgGroups)
    .where(and(eq(orgGroups.id, groupId), eq(orgGroups.organizationId, orgId)))
    .limit(1)

  if (!group) {
    throw createError({ statusCode: 404, message: 'Group not found' })
  }

  // Validate all module/permission keys exist
  for (const perm of permissions) {
    const module = getRegistryModule(perm.moduleKey)
    if (!module) {
      throw createError({
        statusCode: 400,
        message: `Unknown module: ${perm.moduleKey}`
      })
    }
    const validPermission = module.permissions.find(p => p.key === perm.permissionKey)
    if (!validPermission) {
      throw createError({
        statusCode: 400,
        message: `Unknown permission ${perm.permissionKey} for module ${perm.moduleKey}`
      })
    }
  }

  // Process updates - fetch existing permissions first
  let added = 0
  let removed = 0
  let updated = 0

  // Get all existing permissions for this group in one query
  const existingPermissions = await db
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

  // Create lookup map
  const existingMap = new Map(
    existingPermissions.map(p => [`${p.moduleKey}:${p.permissionKey}`, p])
  )

  await db.transaction(async (tx) => {
    for (const perm of permissions) {
      const key = `${perm.moduleKey}:${perm.permissionKey}`
      const existing = existingMap.get(key)

      if (perm.effect === null) {
        // Remove permission (inherit)
        if (existing) {
          await tx.delete(orgGroupModulePermissions)
            .where(eq(orgGroupModulePermissions.id, existing.id))
          removed++
        }
      } else if (existing) {
        // Update existing
        if (existing.effect !== perm.effect) {
          await tx.update(orgGroupModulePermissions)
            .set({
              effect: perm.effect,
              updatedAt: new Date()
            })
            .where(eq(orgGroupModulePermissions.id, existing.id))
          updated++
        }
      } else {
        // Insert new
        await tx.insert(orgGroupModulePermissions).values({
          id: createId(),
          organizationId: orgId,
          groupId,
          moduleKey: perm.moduleKey,
          permissionKey: perm.permissionKey,
          effect: perm.effect
        })
        added++
      }
    }
  })

  // Audit log
  await logOrganizationAction(event, 'GROUP_PERMISSIONS_UPDATED', {
    groupId,
    groupName: group.name,
    added,
    updated,
    removed,
    totalChanges: permissions.length
  }, orgId)

  return {
    success: true,
    organizationId: orgId,
    groupId,
    changes: {
      added,
      updated,
      removed
    }
  }
})
