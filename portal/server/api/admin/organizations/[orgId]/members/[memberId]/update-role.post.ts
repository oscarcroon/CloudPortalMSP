import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { rbacRoles } from '~/constants/rbac'
import {
  organizationMemberships,
  users
} from '../../../../../../database/schema'
import { getDb } from '../../../../../../utils/db'
import type { DrizzleDb } from '../../../../../../utils/db'
import {
  assertOwnerWillRemain,
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess
} from '../../../utils'
import { logUserAction } from '../../../../../../utils/audit'

const payloadSchema = z.object({
  role: z.enum(rbacRoles)
})

const parseMemberParam = (event: Parameters<typeof parseOrgParam>[0]) => {
  const value = parseOrgParam(event, 'memberId')
  return value
}

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const memberParam = parseMemberParam(event)
  const payload = payloadSchema.parse(await readBody(event))

  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - allows superadmins and tenant admins
  await requireOrganizationManageAccess(event, organization)

  const [membership] = await db
    .select({
      id: organizationMemberships.id,
      organizationId: organizationMemberships.organizationId,
      userId: organizationMemberships.userId,
      role: organizationMemberships.role,
      status: organizationMemberships.status
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.id, memberParam))

  if (!membership || membership.organizationId !== organization.id || membership.status !== 'active') {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas eller är inte aktiv.' })
  }

  if (membership.role === payload.role) {
    return fetchMemberPayload(db, membership.id)
  }

  const oldRole = membership.role

  if (membership.role === 'owner' && payload.role !== 'owner') {
    await assertOwnerWillRemain(db, organization.id, membership.id)
  }

  await db
    .update(organizationMemberships)
    .set({ role: payload.role })
    .where(eq(organizationMemberships.id, membership.id))

  // Log audit event
  await logUserAction(event, 'ROLE_CHANGED', {
    targetUserId: membership.userId,
    organizationId: organization.id,
    oldRole,
    newRole: payload.role
  }, membership.userId)

  return fetchMemberPayload(db, membership.id)
})

const fetchMemberPayload = async (db: DrizzleDb, membershipId: string) => {
  const [member] = await db
    .select({
      membershipId: organizationMemberships.id,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      role: organizationMemberships.role,
      status: organizationMemberships.status,
      addedAt: organizationMemberships.createdAt
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .where(eq(organizationMemberships.id, membershipId))

  if (!member) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  return {
    member: {
      membershipId: member.membershipId,
      userId: member.userId,
      email: member.email,
      fullName: member.fullName,
      role: member.role,
      status: member.status,
      addedAt: member.addedAt
    }
  }
}

