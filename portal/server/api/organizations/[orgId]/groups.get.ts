import { defineEventHandler, createError, getRouterParam } from 'h3'
import { and, eq, inArray } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroups, orgGroupMembers, users } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const db = getDb()

  const groups = await db
    .select({
      id: orgGroups.id,
      name: orgGroups.name,
      description: orgGroups.description,
      createdAt: orgGroups.createdAt,
      updatedAt: orgGroups.updatedAt
    })
    .from(orgGroups)
    .where(eq(orgGroups.organizationId, orgId))

  const groupIds = groups.map((g) => g.id)
  const membersByGroup: Record<string, { userId: string; email: string | null; fullName: string | null }[]> =
    {}

  if (groupIds.length) {
    try {
      const memberRows = await db
        .select({
          groupId: orgGroupMembers.groupId,
          userId: orgGroupMembers.userId,
          email: users.email,
          fullName: users.fullName
        })
        .from(orgGroupMembers)
        .leftJoin(orgGroups, eq(orgGroups.id, orgGroupMembers.groupId))
        .leftJoin(users, eq(users.id, orgGroupMembers.userId))
        .where(and(eq(orgGroups.organizationId, orgId), inArray(orgGroupMembers.groupId, groupIds)))

      for (const row of memberRows) {
        if (!membersByGroup[row.groupId]) {
          membersByGroup[row.groupId] = []
        }
        membersByGroup[row.groupId].push({
          userId: row.userId,
          email: row.email ?? null,
          fullName: row.fullName ?? null
        })
      }
    } catch (error: any) {
      // Om kolumn saknas (äldre DB) – returnera grupper utan medlemmar istället för 500
      console.warn('[org-groups] member query failed', error?.message)
    }
  }

  return {
    organizationId: orgId,
    groups: groups.map((group) => ({
      ...group,
      members: membersByGroup[group.id] ?? []
    }))
  }
})


