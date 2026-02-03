import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { rbacRoles } from '~/constants/rbac'
import type { OrganizationMemberStatus } from '~/types/admin'
import { organizationMemberships, users } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import type { DrizzleDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'
import { assertOwnerWillRemain, findOrganizationByIdentifier } from '~~/server/api/admin/organizations/utils'
import { logUserAction } from '~~/server/utils/audit'

const payloadSchema = z.object({
  role: z.enum(rbacRoles).optional(),
  status: z.enum(['active', 'suspended']).optional()
})

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

  const payload = payloadSchema.parse(await readBody(event))

  if (!payload.role && !payload.status) {
    throw createError({ statusCode: 400, message: 'Specify role or status to update.' })
  }

  const [membership] = await db.select({
    id: organizationMemberships.id, organizationId: organizationMemberships.organizationId,
    userId: organizationMemberships.userId, role: organizationMemberships.role, status: organizationMemberships.status
  }).from(organizationMemberships).where(eq(organizationMemberships.id, memberId))

  if (!membership || membership.organizationId !== organization.id) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  if (membership.status !== 'active' && payload.role) {
    throw createError({ statusCode: 400, message: 'Cannot change role for inactive member.' })
  }

  const updates: Partial<{ role: string; status: OrganizationMemberStatus }> = {}
  const oldRole = membership.role
  const oldStatus = membership.status

  if (payload.role && payload.role !== membership.role) {
    if (membership.role === 'owner' && payload.role !== 'owner') {
      await assertOwnerWillRemain(db, organization.id, membership.id)
    }
    updates.role = payload.role
  }

  if (payload.status && payload.status !== membership.status) {
    if (membership.role === 'owner' && payload.status === 'suspended') {
      await assertOwnerWillRemain(db, organization.id, membership.id)
    }
    updates.status = payload.status
  }

  if (Object.keys(updates).length === 0) {
    return fetchMemberPayload(db, membership.id)
  }

  await db.update(organizationMemberships).set(updates as any).where(eq(organizationMemberships.id, membership.id))

  if (updates.role) {
    await logUserAction(event, 'ROLE_CHANGED', { targetUserId: membership.userId, organizationId: organization.id, oldRole, newRole: updates.role }, membership.userId)
  }

  if (updates.status) {
    await logUserAction(event, 'STATUS_CHANGED', { targetUserId: membership.userId, organizationId: organization.id, oldStatus, newStatus: updates.status }, membership.userId)
  }

  return fetchMemberPayload(db, membership.id)
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
