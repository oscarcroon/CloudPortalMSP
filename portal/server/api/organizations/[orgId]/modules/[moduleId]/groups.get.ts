import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'
import { orgGroupModulePermissions } from '~~/server/database/schema'
import type { ModuleId } from '~/constants/modules'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const moduleId = getRouterParam(event, 'moduleId') as ModuleId

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Missing module ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const db = getDb()
  const rows = await db
    .select({
      groupId: orgGroupModulePermissions.groupId,
      permissionKey: orgGroupModulePermissions.permissionKey,
      effect: orgGroupModulePermissions.effect
    })
    .from(orgGroupModulePermissions)
    .where(
      and(
        eq(orgGroupModulePermissions.organizationId, orgId),
        eq(orgGroupModulePermissions.moduleKey, moduleId)
      )
    )

  const assignments = new Map<
    string,
    { groupId: string; grants: string[]; denies: string[] }
  >()

  for (const row of rows) {
    if (!assignments.has(row.groupId)) {
      assignments.set(row.groupId, { groupId: row.groupId, grants: [], denies: [] })
    }
    const entry = assignments.get(row.groupId)!
    if (row.effect === 'deny') {
      entry.denies.push(row.permissionKey)
    } else {
      entry.grants.push(row.permissionKey)
    }
  }

  return { assignments: Array.from(assignments.values()) }
})




