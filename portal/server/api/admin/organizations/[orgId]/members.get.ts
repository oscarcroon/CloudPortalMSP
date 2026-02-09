import { defineEventHandler } from 'h3'
import { and, eq, inArray } from 'drizzle-orm'
import {
  organizationInvitations,
  organizationMemberships,
  users
} from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { normalizeEmail } from '../../../../utils/crypto'
import { parseOrgParam, requireOrganizationByIdentifier, requireOrganizationReadAccess } from '../utils'

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - allows superadmins and tenant admins
  await requireOrganizationReadAccess(event, organization)

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

  // Get pending invitations only
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
    .where(
      and(
        eq(organizationInvitations.organizationId, organization.id),
        eq(organizationInvitations.status, 'pending')
      )
    )

  // Auto-accept pending invitations where user is already a member
  const memberEmails = new Set(memberRows.map((m) => normalizeEmail(m.email)))
  const invitesToAutoAccept = inviteRows.filter((inv) =>
    memberEmails.has(normalizeEmail(inv.email))
  )

  if (invitesToAutoAccept.length > 0) {
    const inviteIdsToAccept = invitesToAutoAccept.map((inv) => inv.id)
    await db
      .update(organizationInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date()
      })
      .where(inArray(organizationInvitations.id, inviteIdsToAccept))
  }

  // Filter out auto-accepted invitations from the response
  const pendingInvites = inviteRows.filter(
    (inv) => !memberEmails.has(normalizeEmail(inv.email))
  )

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
    invites: pendingInvites.map((row) => ({
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

