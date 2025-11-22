import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import {
  organizationInvitations,
  organizationMemberships,
  users
} from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireSuperAdmin } from '../../../../utils/rbac'
import { parseOrgParam, requireOrganizationByIdentifier } from '../utils'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)

  const memberRows = await db
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
    .where(eq(organizationMemberships.organizationId, organization.id))

  const inviteRows = await db
    .select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      status: organizationInvitations.status,
      invitedAt: organizationInvitations.createdAt,
      expiresAt: organizationInvitations.expiresAt,
      invitedById: organizationInvitations.invitedByUserId,
      invitedByEmail: users.email,
      invitedByName: users.fullName
    })
    .from(organizationInvitations)
    .leftJoin(users, eq(users.id, organizationInvitations.invitedByUserId))
    .where(eq(organizationInvitations.organizationId, organization.id))

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      requireSso: Boolean(organization.requireSso)
    },
    members: memberRows.map((row) => ({
      membershipId: row.membershipId,
      userId: row.userId,
      email: row.email,
      fullName: row.fullName,
      role: row.role,
      status: row.status,
      addedAt: row.addedAt
    })),
    invites: inviteRows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      invitedAt: row.invitedAt,
      expiresAt: row.expiresAt,
      invitedBy:
        row.invitedById && row.invitedByEmail
          ? {
              id: row.invitedById,
              email: row.invitedByEmail,
              fullName: row.invitedByName
            }
          : null
    }))
  }
})

