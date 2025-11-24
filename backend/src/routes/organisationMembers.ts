async function sendOrRespondWithInvitation(
  res: Response,
  invitation: OrganisationInvitation,
  options: {
    organisation: Organisation
    to: string
    invitedBy: string
    role: OrganisationMemberRole
    organisationLogo?: string | null
  }
) {
  try {
    const expiresAtMs = new Date(invitation.expiresAt).getTime()
    const deliveryResult = await sendInvitationEmail({
      to: options.to,
      organisationId: invitation.organisationId,
      invitedBy: options.invitedBy,
      organisationName: options.organisation.name,
      role: options.role,
      expiresAt: Number.isFinite(expiresAtMs) ? expiresAtMs : Date.now(),
      token: invitation.token,
      organisationLogo: options.organisationLogo
    })

    const emailDelivery =
      'delivery' in deliveryResult
        ? {
            delivered: deliveryResult.delivery.delivered ?? true,
            channel: deliveryResult.delivery.channel ?? null
          }
        : {
            delivered: false,
            storedAt: deliveryResult.storedAt
          }

    res.status(emailDelivery.delivered ? 201 : 202).json({ invitation, emailDelivery })
  } catch (error) {
    console.error('[invite] Failed to send invitation email', error)
    const friendly = describeEmailSendError(error)
    res.status(502).json({
      message: `Inbjudan skapades men mejlet kunde inte skickas. ${friendly}`
    })
  }
}
import { Router } from 'express'
import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { and, eq, inArray, lt, ne } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  organisationInvitationsTable,
  organisationMembershipsTable,
  organisationsTable,
  usersTable
} from '../db/schema.js'
import type {
  Organisation,
  OrganisationInvitation,
  OrganisationMember,
  OrganisationMemberRole,
  OrganisationMemberStatus
} from '../types/domain.js'
import { ensurePermission } from '../utils/authz.js'
import { describeEmailSendError } from '../utils/emailTest.js'
import { sendInvitationEmail } from '../utils/mailer.js'
import { assertOrganisationScope } from '../utils/organisationScope.js'

const INVITATION_EXPIRATION_DAYS = 7
const INVITATION_RETENTION_DAYS = 7
const INVITATION_ACCEPTED_RETENTION_HOURS = 24

export const organisationMembersRouter = Router()

organisationMembersRouter.get('/:organisationId/members', async (req, res) => {
  if (!ensurePermission(req, res, 'org:read')) {
    return
  }
  const { organisationId } = req.params
  const organisation = await assertOrganisationScope(req, res, organisationId)
  if (!organisation) {
    return
  }

  await pruneStaleInvitations(organisationId)

  const memberRows = await db
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
    .where(eq(organisationMembershipsTable.organizationId, organisationId))

  const inviteRows = await db
    .select({
      id: organisationInvitationsTable.id,
      email: organisationInvitationsTable.email,
      role: organisationInvitationsTable.role,
      status: organisationInvitationsTable.status,
      invitedAt: organisationInvitationsTable.createdAt,
      expiresAt: organisationInvitationsTable.expiresAt,
      invitedByUserId: organisationInvitationsTable.invitedByUserId,
      invitedByEmail: usersTable.email,
      invitedByName: usersTable.fullName
    })
    .from(organisationInvitationsTable)
    .leftJoin(usersTable, eq(usersTable.id, organisationInvitationsTable.invitedByUserId))
    .where(eq(organisationInvitationsTable.organizationId, organisationId))

  const now = new Date()
  const expiredInviteIds: string[] = []

  const invitations = inviteRows.map((row) => {
    const expiresAtDate = new Date(row.expiresAt)
    const isExpired =
      row.status === 'pending' && !Number.isNaN(expiresAtDate.getTime()) && expiresAtDate.getTime() < now.getTime()
    if (isExpired) {
      expiredInviteIds.push(row.id)
    }
    const status = isExpired ? 'expired' : (row.status as OrganisationInvitation['status'])
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status,
      invitedAt: toIso(row.invitedAt),
      expiresAt: toIso(row.expiresAt),
      invitedBy: row.invitedByEmail || row.invitedByName || null
    }
  })

  if (expiredInviteIds.length) {
    await db
      .update(organisationInvitationsTable)
      .set({ status: 'expired', updatedAt: now })
      .where(inArray(organisationInvitationsTable.id, expiredInviteIds))
  }

  const members = memberRows.map((row) => mapMemberRow(row))
  res.json({ organisation, members, invitations })
})

organisationMembersRouter.post('/:organisationId/members/invite', async (req, res) => {
  if (!ensurePermission(req, res, 'users:invite')) {
    return
  }
  const { organisationId } = req.params
  const organisation = await assertOrganisationScope(req, res, organisationId)
  if (!organisation) {
    return
  }
  const { email, role, directAdd } = req.body as Partial<{
    email: string
    role: OrganisationMemberRole
    directAdd: boolean
  }>
  if (!email || !role) {
    res.status(400).json({ message: 'Email and role are required.' })
    return
  }

  if (!isAssignableRole(role)) {
    res.status(400).json({ message: 'Unsupported role supplied.' })
    return
  }

  const allowDirectAdd = Boolean(organisation.requireSso)
  const defaultDirectAdd = allowDirectAdd
  const shouldDirectAdd = Boolean(
    typeof directAdd === 'boolean' ? directAdd && allowDirectAdd : defaultDirectAdd
  )

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    res.status(400).json({ message: 'Email is invalid.' })
    return
  }

  const existingMember = await db
    .select({
      id: organisationMembershipsTable.id,
      status: organisationMembershipsTable.status
    })
    .from(organisationMembershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, organisationMembershipsTable.userId))
    .where(
      and(
        eq(organisationMembershipsTable.organizationId, organisationId),
        eq(usersTable.email, normalizedEmail)
      )
    )
    .get()

  if (existingMember && existingMember.status === 'active') {
    res.status(409).json({ message: 'User is already a member of this organisation.' })
    return
  }

  const invitedBy = req.userContext?.email ?? req.userContext?.id ?? 'system'
  const user = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).get()

  if (user) {
    if (existingMember) {
      await db
        .update(organisationMembershipsTable)
          .set({ role, status: 'active', updatedAt: new Date() })
        .where(eq(organisationMembershipsTable.id, existingMember.id))
    } else if (shouldDirectAdd) {
      await db.insert(organisationMembershipsTable).values({
        organizationId: organisationId,
        userId: user.id,
        role,
        status: 'active'
      })
      const members = await fetchMembers(organisationId)
      res.status(201).json({ organisation, members })
      return
    } else {
      // User exists men saknar medlemskap -> skapa inbjudan istället
      const invitation = await createInvitationRecord({
        organisationId,
        email: normalizedEmail,
        role,
        invitedBy,
        invitedByUserId: req.userContext?.id
      })
      await sendOrRespondWithInvitation(res, invitation, {
        organisation,
        to: normalizedEmail,
        invitedBy,
        role,
        organisationLogo: organisation.branding?.logoUrl ?? null
      })
      return
    }
  }

  if (shouldDirectAdd) {
    const newUserId = `user-${randomUUID()}`
    await db.insert(usersTable).values({
      id: newUserId,
      email: normalizedEmail,
      fullName: null,
      status: 'active'
    })

    await db.insert(organisationMembershipsTable).values({
      id: `m-${randomUUID()}`,
      organizationId: organisationId,
      userId: newUserId,
      role,
      status: 'active'
    })

    const members = await fetchMembers(organisationId)
    res.status(201).json({ organisation, members })
    return
  }

  const invitation = await createInvitationRecord({
    organisationId,
    email: normalizedEmail,
    role,
    invitedBy,
    invitedByUserId: req.userContext?.id
  })

await sendOrRespondWithInvitation(res, invitation, {
  organisation,
  to: normalizedEmail,
  invitedBy,
  role,
  organisationLogo: organisation.branding?.logoUrl ?? null
})
})

organisationMembersRouter.patch('/:organisationId/members/:memberId', async (req, res) => {
  if (!ensurePermission(req, res, 'users:manage')) {
    return
  }
  const { organisationId, memberId } = req.params
  const organisation = await assertOrganisationScope(req, res, organisationId)
  if (!organisation) {
    return
  }

  const member = await fetchMember(organisationId, memberId)
  if (!member) {
    res.status(404).json({ message: 'Member not found.' })
    return
  }

  const { role, status } = req.body as Partial<{
    role: OrganisationMemberRole
    status: OrganisationMemberStatus
  }>

  if (!role && !status) {
    res.status(400).json({ message: 'No changes supplied.' })
    return
  }

  if (role && !isValidMemberRole(role)) {
    res.status(400).json({ message: 'Unsupported role supplied.' })
    return
  }

  if (status && !isValidMemberStatus(status)) {
    res.status(400).json({ message: 'Unsupported status supplied.' })
    return
  }

  if (
    member.role === 'owner' &&
    ((role && role !== 'owner') || (status && status !== 'active')) &&
    (await isLastActiveOwner(organisationId, member.id))
  ) {
    res.status(400).json({ message: 'Organisation must keep at least one active owner.' })
    return
  }

  await db
    .update(organisationMembershipsTable)
    .set({
      ...(role ? { role } : {}),
      ...(status ? { status: mapStatusForStorage(status) } : {}),
      updatedAt: new Date()
    })
    .where(eq(organisationMembershipsTable.id, memberId))

  const updated = await fetchMember(organisationId, memberId)
  res.json(updated)
})

organisationMembersRouter.delete('/:organisationId/members/:memberId', async (req, res) => {
  if (!ensurePermission(req, res, 'users:manage')) {
    return
  }
  const { organisationId, memberId } = req.params
  const organisation = await assertOrganisationScope(req, res, organisationId)
  if (!organisation) {
    return
  }

  const member = await fetchMember(organisationId, memberId)
  if (!member) {
    res.status(404).json({ message: 'Member not found.' })
    return
  }

  if (member.role === 'owner' && (await isLastActiveOwner(organisationId, member.id))) {
    res.status(400).json({ message: 'Organisation must keep at least one active owner.' })
    return
  }

  await db.delete(organisationMembershipsTable).where(eq(organisationMembershipsTable.id, memberId))
  res.status(204).send()
})

organisationMembersRouter.delete('/:organisationId/invitations/:invitationId', async (req, res) => {
  if (!ensurePermission(req, res, 'users:invite')) {
    return
  }
  const { organisationId, invitationId } = req.params
  const organisation = await assertOrganisationScope(req, res, organisationId)
  if (!organisation) {
    return
  }

  const invitation = await db
    .select({
      id: organisationInvitationsTable.id,
      status: organisationInvitationsTable.status
    })
    .from(organisationInvitationsTable)
    .where(
      and(
        eq(organisationInvitationsTable.id, invitationId),
        eq(organisationInvitationsTable.organizationId, organisationId)
      )
    )
    .get()

  if (!invitation) {
    res.status(404).json({ message: 'Invitation not found.' })
    return
  }

  if (invitation.status !== 'pending') {
    res.status(409).json({ message: 'Invitation can no longer be cancelled.' })
    return
  }

  await db
    .update(organisationInvitationsTable)
    .set({
      status: 'cancelled',
      declinedAt: new Date(),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(organisationInvitationsTable.id, invitationId),
        eq(organisationInvitationsTable.organizationId, organisationId)
      )
    )

  res.status(204).send()
})

function isAssignableRole(role: OrganisationMemberRole) {
  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'member' ||
    role === 'operator' ||
    role === 'viewer'
  )
}

function isValidMemberRole(role: OrganisationMemberRole) {
  return isAssignableRole(role)
}

function isValidMemberStatus(status: OrganisationMemberStatus): status is OrganisationMemberStatus {
  return status === 'active' || status === 'invited' || status === 'inactive'
}

async function isLastActiveOwner(organisationId: string, memberId: string) {
  const owners = await db
    .select({ id: organisationMembershipsTable.id })
    .from(organisationMembershipsTable)
    .where(
      and(
        eq(organisationMembershipsTable.organizationId, organisationId),
        eq(organisationMembershipsTable.role, 'owner'),
        eq(organisationMembershipsTable.status, 'active')
      )
    )

  return owners.length === 1 && owners[0]?.id === memberId
}

export async function fetchMembers(organisationId: string) {
  const rows = await db
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
    .where(eq(organisationMembershipsTable.organizationId, organisationId))

  return rows.map((row) => mapMemberRow(row))
}

export async function fetchMember(organisationId: string, memberId: string) {
  const row = await db
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
        eq(organisationMembershipsTable.organizationId, organisationId),
        eq(organisationMembershipsTable.id, memberId)
      )
    )
    .get()

  return row ? mapMemberRow(row) : null
}

export function mapMemberRow(row: {
  id: string
  organisationId: string
  userId: string
  role: string
  status: string
  email: string
  fullName: string | null
  createdAt: number | Date
  updatedAt: number | Date
}): OrganisationMember {
  return {
    id: row.id,
    organisationId: row.organisationId,
    userId: row.userId,
    email: row.email,
    displayName: row.fullName ?? row.email,
    role: (row.role as OrganisationMemberRole) ?? 'member',
    status: mapStatusForResponse(row.status),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  }
}

export function mapStatusForResponse(status: string): OrganisationMemberStatus {
  if (status === 'active' || status === 'invited') {
    return status
  }
  return 'inactive'
}

function mapStatusForStorage(status: OrganisationMemberStatus) {
  if (status === 'inactive') {
    return 'suspended'
  }
  return status
}

async function createInvitationRecord({
  organisationId,
  email,
  role,
  invitedBy,
  invitedByUserId
}: {
  organisationId: string
  email: string
  role: OrganisationMemberRole
  invitedBy: string
  invitedByUserId?: string | null
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
  const invitation: OrganisationInvitation = {
    id: `invite-${randomUUID()}`,
    organisationId,
    email,
    role,
    token: randomUUID(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
    invitedBy,
    createdAt: now.toISOString()
  }

  await db.insert(organisationInvitationsTable).values({
    id: invitation.id,
    organizationId: organisationId,
    email,
    role,
    token: invitation.token,
    status: 'pending',
    invitedByUserId: invitedByUserId ?? null,
    expiresAt,
    createdAt: now,
    updatedAt: now
  })

  return invitation
}

function toIso(value: number | Date) {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return new Date(value).toISOString()
}

async function pruneStaleInvitations(organisationId: string) {
  const retentionMs = INVITATION_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const cutoff = new Date(Date.now() - retentionMs)
  await db
    .delete(organisationInvitationsTable)
    .where(
      and(
        eq(organisationInvitationsTable.organizationId, organisationId),
        ne(organisationInvitationsTable.status, 'pending'),
        lt(organisationInvitationsTable.updatedAt, cutoff)
      )
    )

  const acceptedCutoff = new Date(Date.now() - INVITATION_ACCEPTED_RETENTION_HOURS * 60 * 60 * 1000)
  await db
    .delete(organisationInvitationsTable)
    .where(
      and(
        eq(organisationInvitationsTable.organizationId, organisationId),
        eq(organisationInvitationsTable.status, 'accepted'),
        lt(organisationInvitationsTable.updatedAt, acceptedCutoff)
      )
    )
}


