import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { organizationInvitations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'
import { createInviteToken, findOrganizationByIdentifier } from '~~/server/api/admin/organizations/utils'
import { sendInvitationEmail } from '~~/server/utils/mailer'
import { describeEmailSendError } from '~~/server/utils/emailTest'
import { logUserAction } from '~~/server/utils/audit'

const INVITE_VALIDITY_MS = 1000 * 60 * 60 * 24 * 14

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const invitationId = getRouterParam(event, 'invitationId')

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }
  if (!invitationId) {
    throw createError({ statusCode: 400, message: 'Missing invitation ID' })
  }

  const db = getDb()
  const organization = await findOrganizationByIdentifier(db, orgId)
  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  const { auth } = await requirePermission(event, 'users:invite', organization.id)

  const [invitation] = await db.select({
    id: organizationInvitations.id, organizationId: organizationInvitations.organizationId,
    email: organizationInvitations.email, role: organizationInvitations.role, status: organizationInvitations.status
  }).from(organizationInvitations).where(and(eq(organizationInvitations.id, invitationId), eq(organizationInvitations.organizationId, organization.id)))

  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Invitation not found' })
  }

  if (invitation.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'Only pending invitations can be resent.' })
  }

  const newToken = createInviteToken()
  const newExpiresAt = new Date(Date.now() + INVITE_VALIDITY_MS)

  await db.update(organizationInvitations).set({ token: newToken, expiresAt: newExpiresAt, invitedByUserId: auth.user.id, updatedAt: new Date() }).where(eq(organizationInvitations.id, invitationId))

  const invitedByLabel = auth.user.fullName?.trim() || auth.user.email

  try {
    await sendInvitationEmail({
      organizationId: organization.id, organizationName: organization.name, invitedBy: invitedByLabel,
      role: invitation.role as string, to: invitation.email, expiresAt: newExpiresAt.getTime(),
      token: newToken, organizationLogo: organization.logoUrl ?? null
    })
  } catch (error) {
    console.error('[resend] Failed to send invitation email', error)
    throw createError({ statusCode: 502, message: `Failed to resend invitation. ${describeEmailSendError(error)}` })
  }

  await logUserAction(event, 'INVITATION_RESENT', { inviteEmail: invitation.email, organizationId: organization.id, invitationId: invitation.id })

  const [updated] = await db.select({
    id: organizationInvitations.id, email: organizationInvitations.email, role: organizationInvitations.role,
    status: organizationInvitations.status, invitedAt: organizationInvitations.createdAt, expiresAt: organizationInvitations.expiresAt
  }).from(organizationInvitations).where(eq(organizationInvitations.id, invitationId))

  return {
    invite: {
      id: updated.id, email: updated.email, role: updated.role, status: updated.status,
      invitedAt: updated.invitedAt, expiresAt: updated.expiresAt,
      invitedBy: { id: auth.user.id, email: auth.user.email, fullName: auth.user.fullName }
    }
  }
})
