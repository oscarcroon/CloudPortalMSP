import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { organizationMemberships, users } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import type { DrizzleDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'
import { assertOwnerWillRemain, findOrganizationByIdentifier } from '~~/server/api/admin/organizations/utils'
import { logUserAction } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const memberId = getRouterParam(event, 'memberId')

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }
  if (!memberId) {
    throw createError({ statusCode: 400, message: 'Missing member ID' })
  }

  const db = getDb()
  const organization = await findOrganizationByIdentifier(db, orgId)
  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  await requirePermission(event, 'users:manage', organization.id)

  const [membership] = await db.select({
    id: organizationMemberships.id, organizationId: organizationMemberships.organizationId,
    role: organizationMemberships.role, status: organizationMemberships.status
  }).from(organizationMemberships).where(eq(organizationMemberships.id, memberId))

  if (!membership || membership.organizationId !== organization.id) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  if (membership.role === 'owner' && membership.status === 'active') {
    await assertOwnerWillRemain(db, organization.id, membership.id)
  }

  const memberPayload = await fetchMemberPayload(db, membership.id)

  await db.delete(organizationMemberships).where(eq(organizationMemberships.id, membership.id))

  await logUserAction(event, 'USER_REMOVED', { targetUserId: memberPayload.member.userId, organizationId: organization.id, role: membership.role }, memberPayload.member.userId)

  return memberPayload
})

const fetchMemberPayload = async (db: DrizzleDb, membershipId: string) => {
  const [member] = await db.select({
    membershipId: organizationMemberships.id, userId: users.id, email: users.email, fullName: users.fullName,
    role: organizationMemberships.role, status: organizationMemberships.status, addedAt: organizationMemberships.createdAt
  }).from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId)).where(eq(organizationMemberships.id, membershipId))

  if (!member) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  return { member: { membershipId: member.membershipId, userId: member.userId, email: member.email, fullName: member.fullName, role: member.role, status: member.status, addedAt: member.addedAt } }
}
