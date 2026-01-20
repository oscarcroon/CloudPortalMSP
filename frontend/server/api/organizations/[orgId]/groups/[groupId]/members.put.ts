import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { and, eq, inArray, sql } from 'drizzle-orm'
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

  // Safeguard for older DBs missing group_id column or using legacy org_group_id
  const columns = await db.all<{ name: string }>(sql`PRAGMA table_info('org_group_members')`)
  const hasGroupId = columns.some((c) => c.name === 'group_id')
  const hasOrgGroupId = columns.some((c) => c.name === 'org_group_id')
  const hasOrganizationId = columns.some((c) => c.name === 'organization_id')

  if (!hasGroupId) {
    await db.run(sql`ALTER TABLE org_group_members ADD COLUMN group_id text`)
    await db.run(sql`CREATE INDEX IF NOT EXISTS org_group_members_group_idx ON org_group_members (group_id)`)
    await db.run(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS org_group_members_unique ON org_group_members (group_id, user_id)`
    )
  }

  // If legacy org_group_id exists, backfill group_id and keep org_group_id populated on inserts
  if (hasOrgGroupId) {
    await db.run(sql`UPDATE org_group_members SET group_id = org_group_id WHERE group_id IS NULL`)
  }

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
    if (hasOrgGroupId) {
      // Insert into legacy columns to satisfy NOT NULL org_group_id (and possibly organization_id)
      for (const userId of memberIds) {
        if (hasOrganizationId) {
          await db.run(
            sql`INSERT INTO org_group_members (id, group_id, org_group_id, organization_id, user_id) VALUES (${createId()}, ${groupId}, ${groupId}, ${orgId}, ${userId})`
          )
        } else {
          await db.run(
            sql`INSERT INTO org_group_members (id, group_id, org_group_id, user_id) VALUES (${createId()}, ${groupId}, ${groupId}, ${userId})`
          )
        }
      }
    } else {
      await db.insert(orgGroupMembers).values(
        memberIds.map((userId) => ({
          id: createId(),
          groupId,
          userId
        }))
      )
    }
  }

  return {
    organizationId: orgId,
    groupId,
    members: memberIds
  }
})


