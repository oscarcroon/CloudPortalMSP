import { Router } from 'express'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  organisationInvitationsTable,
  organisationMembershipsTable,
  organisationsTable,
  usersTable
} from '../db/schema.js'
import type { OrganisationInvitation, OrganisationMemberRole } from '../types/domain.js'
import { ensureAuthenticated } from '../utils/authz.js'
import { mapMemberRow } from './organisationMembers.js'

export const invitationsRouter = Router()

invitationsRouter.get('/:token', async (req, res) => {
  if (!ensureAuthenticated(req, res)) {
    return
  }
  const { token } = req.params
  const invitationRow = await db
    .select({
      id: organisationInvitationsTable.id,
      organisationId: organisationInvitationsTable.organizationId,
      email: organisationInvitationsTable.email,
      role: organisationInvitationsTable.role,
      status: organisationInvitationsTable.status,
      token: organisationInvitationsTable.token,
      expiresAt: organisationInvitationsTable.expiresAt,
      createdAt: organisationInvitationsTable.createdAt,
      invitedByUserId: organisationInvitationsTable.invitedByUserId,
      organisationName: organisationsTable.name
    })
    .from(organisationInvitationsTable)
    .leftJoin(organisationsTable, eq(organisationsTable.id, organisationInvitationsTable.organizationId))
    .where(eq(organisationInvitationsTable.token, token))
    .get()

  if (!invitationRow) {
    res.status(404).json({ message: 'Invitation not found.' })
    return
  }

  res.json({
    invitation: sanitizeInvitationRow(invitationRow),
    organisation: invitationRow.organisationId
      ? {
          id: invitationRow.organisationId,
          name: invitationRow.organisationName ?? 'Organisation'
        }
      : null
  })
})

invitationsRouter.post('/accept', async (req, res) => {
  if (!ensureAuthenticated(req, res)) {
    return
  }
  const { token } = req.body as Partial<{ token: string }>
  if (!token) {
    res.status(400).json({ message: 'Missing invitation token.' })
    return
  }

  const invitation = await db
    .select()
    .from(organisationInvitationsTable)
    .where(eq(organisationInvitationsTable.token, token))
    .get()

  if (!invitation) {
    res.status(404).json({ message: 'Invitation not found.' })
    return
  }
  if (invitation.status === 'cancelled') {
    res.status(409).json({ message: 'Invitation has been cancelled.' })
    return
  }
  if (invitation.status === 'accepted') {
    res.status(409).json({ message: 'Invitation already accepted.' })
    return
  }
  const now = new Date()
  if (now > invitation.expiresAt) {
    await db
      .update(organisationInvitationsTable)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(organisationInvitationsTable.id, invitation.id))
    res.status(410).json({ message: 'Invitation has expired.' })
    return
  }
  const userEmail = req.userContext?.email.toLowerCase()
  if (!userEmail || userEmail !== invitation.email.toLowerCase()) {
    res.status(403).json({ message: 'Invitation does not match the current user.' })
    return
  }
  const userId = req.userContext?.id
  if (!userId) {
    res.status(403).json({ message: 'Missing user context.' })
    return
  }

  const membershipSelector = and(
    eq(organisationMembershipsTable.organizationId, invitation.organizationId),
    eq(organisationMembershipsTable.userId, userId)
  )

  const existingMembership = await db
    .select({ id: organisationMembershipsTable.id })
    .from(organisationMembershipsTable)
    .where(membershipSelector)
    .get()

  if (existingMembership?.id) {
    await db
      .update(organisationMembershipsTable)
      .set({
        role: invitation.role,
        status: 'active',
        updatedAt: now
      })
      .where(eq(organisationMembershipsTable.id, existingMembership.id))
  } else {
    await db.insert(organisationMembershipsTable).values({
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
      status: 'active'
    })
  }

  await db
    .update(organisationInvitationsTable)
    .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
    .where(eq(organisationInvitationsTable.id, invitation.id))

  const insertedRow = await db
    .select({
      id: organisationMembershipsTable.id,
      organisationId: organisationMembershipsTable.organizationId,
      userId: organisationMembershipsTable.userId,
      role: organisationMembershipsTable.role,
      status: organisationMembershipsTable.status,
      email: usersTable.email,
      fullName: usersTable.fullName,
      createdAt: organisationMembershipsTable.createdAt,
      updatedAt: organisationMembershipsTable.updatedAt
    })
    .from(organisationMembershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, organisationMembershipsTable.userId))
    .where(
      and(
        eq(organisationMembershipsTable.organizationId, invitation.organizationId),
        eq(organisationMembershipsTable.userId, userId)
      )
    )
    .get()

  res.json({ member: insertedRow ? mapMemberRow(insertedRow) : null })
})

type PublicInvitation = Omit<OrganisationInvitation, 'token'>

function sanitizeInvitationRow(invitation: {
  id: string
  organisationId: string
  email: string
  role: string
  status: string
  expiresAt: number | Date
  createdAt: number | Date
}) {
  const safeInvitation: PublicInvitation = {
    id: invitation.id,
    organisationId: invitation.organisationId,
    email: invitation.email,
    role: invitation.role as OrganisationMemberRole,
    status: mapInvitationStatus(invitation.status),
    expiresAt: toIso(invitation.expiresAt),
    invitedBy: '',
    createdAt: toIso(invitation.createdAt)
  }
  return safeInvitation
}

function mapInvitationStatus(status: string): OrganisationInvitation['status'] {
  if (
    status === 'pending' ||
    status === 'accepted' ||
    status === 'cancelled' ||
    status === 'expired'
  ) {
    return status
  }
  return 'pending'
}

function toIso(value: number | Date) {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return new Date(value).toISOString()
}


