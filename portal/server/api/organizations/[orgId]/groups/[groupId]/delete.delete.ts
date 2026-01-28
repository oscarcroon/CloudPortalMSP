import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroups } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const groupId = getRouterParam(event, 'groupId')

  if (!orgId || !groupId) {
    throw createError({ statusCode: 400, message: 'Missing organization or group ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const db = getDb()

  const [existing] = await db
    .select({ id: orgGroups.id })
    .from(orgGroups)
    .where(and(eq(orgGroups.id, groupId), eq(orgGroups.organizationId, orgId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Gruppen kunde inte hittas' })
  }

  await db.delete(orgGroups).where(and(eq(orgGroups.id, groupId), eq(orgGroups.organizationId, orgId)))

  return { success: true }
})


