import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { createId } from '@paralleldrive/cuid2'
import { and, eq, inArray } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroups, orgGroupMembers, organizationMemberships } from '~~/server/database/schema'
import { slugify } from '~~/server/utils/auth'

const bodySchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional()
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const body = bodySchema.parse(await readBody(event))
  const db = getDb()

  const groupId = createId()
  const baseSlug = slugify(body.name)
  let slug = baseSlug

  // Säkerställ unik slug per organisation
  let counter = 2
  while (true) {
    const existing = await db
      .select({ id: orgGroups.id })
      .from(orgGroups)
      .where(and(eq(orgGroups.organizationId, orgId), eq(orgGroups.slug, slug)))
    if (existing.length === 0) break
    slug = `${baseSlug}-${counter++}`
  }
  await db.insert(orgGroups).values({
    id: groupId,
    organizationId: orgId,
    name: body.name.trim(),
    slug,
    description: body.description?.trim() || null
  })

  const memberIds = Array.from(new Set(body.memberIds ?? [])).filter(Boolean)
  if (memberIds.length) {
    const memberships = await db
      .select({ userId: organizationMemberships.userId })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.organizationId, orgId), inArray(organizationMemberships.userId, memberIds)))

    const membershipSet = new Set(memberships.map((m) => m.userId))
    const invalidMembers = memberIds.filter((id) => !membershipSet.has(id))
    if (invalidMembers.length) {
      throw createError({
        statusCode: 400,
        message: `Ogiltiga medlemmar för organisationen: ${invalidMembers.join(', ')}`
      })
    }

    if (membershipSet.size) {
      await db.insert(orgGroupMembers).values(
        Array.from(membershipSet).map((userId) => ({
          id: createId(),
          groupId,
          userId
        }))
      )
    }
  }

  return {
    organizationId: orgId,
    group: {
      id: groupId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      members: memberIds
    }
  }
})


