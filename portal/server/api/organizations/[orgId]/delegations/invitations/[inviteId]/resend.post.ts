import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { mspOrgDelegationInvitations, organizations } from '~~/server/database/schema'
import { sendDelegationInvitationEmail } from '~~/server/utils/mailer'
import { logUserAction } from '~~/server/utils/audit'
import { createInviteToken } from '~~/server/api/admin/organizations/utils'

const INVITE_VALIDITY_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const inviteId = getRouterParam(event, 'inviteId')

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }
  if (!inviteId) {
    throw createError({ statusCode: 400, message: 'Missing invitation ID' })
  }

  // Require org:manage permission
  const { auth } = await requirePermission(event, 'org:manage', orgId)

  const db = getDb()

  // Get organization
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Find the invitation
  const [invite] = await db
    .select()
    .from(mspOrgDelegationInvitations)
    .where(
      and(
        eq(mspOrgDelegationInvitations.id, inviteId),
        eq(mspOrgDelegationInvitations.orgId, orgId)
      )
    )
    .limit(1)

  if (!invite) {
    throw createError({ statusCode: 404, message: 'Invitation not found' })
  }

  if (invite.status !== 'pending') {
    throw createError({ statusCode: 400, message: 'Only pending invitations can be resent' })
  }

  // Generate new token and extend expiry
  const newToken = createInviteToken()
  const newExpiresAt = new Date(Date.now() + INVITE_VALIDITY_MS)

  // Update invitation with new token and expiry
  await db
    .update(mspOrgDelegationInvitations)
    .set({
      token: newToken,
      expiresAt: newExpiresAt,
      updatedAt: new Date()
    })
    .where(eq(mspOrgDelegationInvitations.id, inviteId))

  const invitedByLabel = auth.user.fullName?.trim() || auth.user.email
  const permissionKeys = JSON.parse(invite.permissionKeys || '[]') as string[]

  // Send the email
  try {
    await sendDelegationInvitationEmail({
      organizationId: org.id,
      organizationName: org.name,
      invitedBy: invitedByLabel,
      permissionCount: permissionKeys.length,
      to: invite.email,
      expiresAt: newExpiresAt.getTime(),
      token: newToken,
      note: invite.note,
      organizationLogo: org.logoUrl ?? null
    })
  } catch (error) {
    console.error('[delegation/invite/resend] Failed to send invitation email:', error)
    throw createError({ statusCode: 500, message: 'Failed to send invitation email' })
  }

  // Log the action
  await logUserAction(event, 'DELEGATION_INVITE_RESENT', {
    inviteId,
    email: invite.email,
    organizationId: orgId
  })

  return {
    success: true,
    inviteId,
    email: invite.email,
    expiresAt: newExpiresAt.getTime(),
    message: 'Invitation resent'
  }
})
