import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import {
  organizationInvitations,
  organizationMemberships,
  organizations,
  users
} from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { normalizeEmail } from '~/server/utils/crypto'
import { requireSession } from '~/server/utils/session'
import type { OrganizationMemberRole } from '~/types/members'
import { sendInviteAcceptedNotification } from '~/server/utils/mailer'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, message: 'Saknar inbjudningstoken.' })
  }

  const auth = await requireSession(event)
  const db = getDb()
  const invitationRow = await db
    .select({
      invitation: organizationInvitations,
      invitedByEmail: users.email,
      invitedByName: users.fullName,
      organisationName: organizations.name
    })
    .from(organizationInvitations)
    .leftJoin(users, eq(users.id, organizationInvitations.invitedByUserId))
    .leftJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
    .where(eq(organizationInvitations.token, token))
    .get()

  const invitation = invitationRow?.invitation

  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Inbjudan hittades inte.' })
  }
  if (invitation.status === 'cancelled') {
    throw createError({ statusCode: 409, message: 'Inbjudan har dragits tillbaka.' })
  }
  if (invitation.status === 'accepted') {
    return { success: true }
  }
  const now = new Date()
  if (now > invitation.expiresAt) {
    await db
      .update(organizationInvitations)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(organizationInvitations.id, invitation.id))
    throw createError({ statusCode: 410, message: 'Inbjudan har gått ut.' })
  }

  const sessionEmail = normalizeEmail(auth.user.email)
  if (sessionEmail !== normalizeEmail(invitation.email)) {
    throw createError({
      statusCode: 403,
      message: 'Du är inloggad med en annan e-postadress än den som bjöds in.'
    })
  }

  const membershipSelector = and(
    eq(organizationMemberships.organizationId, invitation.organizationId),
    eq(organizationMemberships.userId, auth.user.id)
  )
  const existingMembership = await db
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(membershipSelector)
    .get()

  if (existingMembership?.id) {
    await db
      .update(organizationMemberships)
      .set({
        role: invitation.role as OrganizationMemberRole,
        status: 'active',
        updatedAt: now
      })
      .where(eq(organizationMemberships.id, existingMembership.id))
  } else {
    await db.insert(organizationMemberships).values({
      id: createId(),
      organizationId: invitation.organizationId,
      userId: auth.user.id,
      role: invitation.role as OrganizationMemberRole,
      status: 'active',
      createdAt: now,
      updatedAt: now
    })
  }

  await db
    .update(organizationInvitations)
    .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
    .where(eq(organizationInvitations.id, invitation.id))

  // Only update defaultOrgId if user doesn't already have one
  if (!auth.user.defaultOrgId) {
    await db
      .update(users)
      .set({
        defaultOrgId: invitation.organizationId
      })
      .where(eq(users.id, auth.user.id))
  }

  if (invitationRow?.invitedByEmail) {
    try {
      await sendInviteAcceptedNotification({
        organisationId: invitation.organizationId,
        organisationName: invitationRow.organisationName ?? `Organisation ${invitation.organizationId}`,
        invitedByEmail: invitationRow.invitedByEmail,
        memberEmail: invitation.email,
        memberName: auth.user.fullName ?? auth.user.email,
        role: invitation.role
      })
    } catch (error) {
      console.error('[invite] Failed to notify inviter about acceptance', error)
    }
  }

  console.info(
    `[audit][invite] ${invitation.email} accepterade inbjudan till ${invitation.organizationId} som ${invitation.role}`
  )

  return { success: true }
})


