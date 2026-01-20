import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships, users } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'org:read', orgId)

  const db = getDb()

  const rows = await db
    .select({
      userId: organizationMemberships.userId,
      email: users.email,
      fullName: users.fullName
    })
    .from(organizationMemberships)
    .leftJoin(users, eq(users.id, organizationMemberships.userId))
    .where(and(eq(organizationMemberships.organizationId, orgId)))

  return {
    organizationId: orgId,
    members: rows.map((r) => ({
      userId: r.userId,
      email: r.email,
      fullName: r.fullName
    }))
  }
})


