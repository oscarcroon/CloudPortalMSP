import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroupMembers, orgGroups, organizationMemberships } from '~~/server/database/schema'

const bodySchema = z.object({
  memberIds: z.array(z.string()).default([])
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const groupId = getRouterParam(event, 'groupId')

  if (!orgId || !groupId) {
    throw createError({ statusCode: 400, message: 'Missing organization or group ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const body = bodySchema.parse(await readBody(event))
  const memberIds = Array.from(new Set(body.memberIds)).filter(Boolean)

  const db = getDb()

  const [groupRow] = await db
    .select({ id: orgGroups.id })
    .from(orgGroups)
    .where(and(eq(orgGroups.id, groupId), eq(orgGroups.organizationId, orgId)))
    .limit(1)

  if (!groupRow) {
    throw createError({ statusCode: 404, message: 'Gruppen kunde inte hittas' })
  }

  if (memberIds.length) {
    const memberships = await db
      .select({ userId: organizationMemberships.userId })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.organizationId, orgId), inArray(organizationMemberships.userId, memberIds)))

    const membershipSet = new Set(memberships.map((m) => m.userId))
    const invalid = memberIds.filter((id) => !membershipSet.has(id))
    if (invalid.length) {
      throw createError({
        statusCode: 400,
        message: `Ogiltiga medlemmar för organisationen: ${invalid.join(', ')}`
      })
    }
  }

  await db.delete(orgGroupMembers).where(eq(orgGroupMembers.groupId, groupId))

  if (memberIds.length) {
    await db.insert(orgGroupMembers).values(
      memberIds.map((userId) => ({
        id: createId(),
        groupId,
        userId
      }))
    )
  }

  return {
    organizationId: orgId,
    groupId,
    members: memberIds
  }
})


