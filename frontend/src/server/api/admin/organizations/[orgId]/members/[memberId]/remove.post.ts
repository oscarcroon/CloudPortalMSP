import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'
import type { DrizzleDb } from '../../../../../../utils/db'
import { getDb } from '../../../../../../utils/db'
import { requireSuperAdmin } from '../../../../../../utils/rbac'
import {
  assertOwnerWillRemain,
  parseOrgParam,
  requireOrganizationByIdentifier
} from '../../../utils'
import {
  organizationMemberships,
  users
} from '../../../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const memberParam = parseOrgParam(event, 'memberId')
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)

  const [membership] = await db
    .select({
      id: organizationMemberships.id,
      organizationId: organizationMemberships.organizationId,
      role: organizationMemberships.role,
      status: organizationMemberships.status
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.id, memberParam))

  if (!membership || membership.organizationId !== organization.id) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  if (membership.role === 'owner' && membership.status === 'active') {
    await assertOwnerWillRemain(db, organization.id, membership.id)
  }

  await db
    .update(organizationMemberships)
    .set({ status: 'suspended' })
    .where(eq(organizationMemberships.id, membership.id))

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

