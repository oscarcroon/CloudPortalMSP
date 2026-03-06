import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq, inArray } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import {
  organizationInvitations,
  organizationMemberships,
  organizations,
  users
} from '~~/server/database/schema'
import { normalizeEmail } from '~~/server/utils/crypto'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'org:read', orgId)

  const db = getDb()

  // Get organization info
  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      requireSso: organizations.requireSso
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))

  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Get members
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
    .where(eq(organizationMemberships.organizationId, orgId))

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
        eq(organizationInvitations.organizationId, orgId),
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
      id: row.membershipId,
      membershipId: row.membershipId,
      organizationId: orgId,
      userId: row.userId,
      email: row.email,
      displayName: row.fullName || undefined,
      fullName: row.fullName,
      role: row.role,
      status: row.status,
      createdAt: row.addedAt,
      updatedAt: row.addedAt,
      addedAt: row.addedAt
    })),
    invitations: pendingInvites.map((row) => ({
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


