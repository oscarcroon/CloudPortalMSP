import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships } from '~~/server/database/schema'
import { getMemberModuleRolePayload } from './utils'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const memberId = getRouterParam(event, 'memberId')

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  if (!memberId) {
    throw createError({ statusCode: 400, message: 'Missing member ID' })
  }

  await requirePermission(event, 'users:manage', orgId)

  const db = getDb()
  const [membership] = await db
    .select({
      id: organizationMemberships.id,
      organizationId: organizationMemberships.organizationId,
      userId: organizationMemberships.userId,
      role: organizationMemberships.role
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.id, memberId))

  if (!membership || membership.organizationId !== orgId) {
    throw createError({ statusCode: 404, message: 'Member not found in this organization' })
  }

  if (!membership.userId) {
    throw createError({ statusCode: 400, message: 'Member is not linked to a user account yet' })
  }

  const payload = await getMemberModuleRolePayload(orgId, membership.userId, membership.role)

  return {
    organizationId: orgId,
    memberId: membership.id,
    userId: membership.userId,
    modules: payload
  }
})

