import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { organizationMemberships, organizations, users } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { requireSuperAdmin } from '~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Saknar användar-id.' })
  }
  const db = getDb()

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      status: users.status,
      isSuperAdmin: users.isSuperAdmin,
      forcePasswordReset: users.forcePasswordReset,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })
    .from(users)
    .where(eq(users.id, userId))

  if (!user) {
    throw createError({ statusCode: 404, message: 'Användaren kunde inte hittas.' })
  }

  const memberships = await db
    .select({
      id: organizationMemberships.id,
      organizationId: organizations.id,
      organizationName: organizations.name,
      role: organizationMemberships.role,
      status: organizationMemberships.status
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(eq(organizationMemberships.userId, userId))

  return {
    user: {
      ...user,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      forcePasswordReset: Boolean(user.forcePasswordReset)
    },
    organizations: memberships.map((membership) => ({
      id: membership.organizationId,
      name: membership.organizationName,
      role: membership.role,
      membershipStatus: membership.status
    }))
  }
})


