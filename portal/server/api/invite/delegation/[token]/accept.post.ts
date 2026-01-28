import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import {
  mspOrgDelegationInvitations,
  mspOrgDelegations,
  mspOrgDelegationPermissions
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireSession } from '~~/server/utils/session'
import { logUserAction } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, message: 'Missing token' })
  }

  // Require authenticated user
  const auth = await requireSession(event)

  const db = getDb()

  // Find the invitation
  const [invite] = await db
    .select()
    .from(mspOrgDelegationInvitations)
    .where(eq(mspOrgDelegationInvitations.token, token))
    .limit(1)

  if (!invite) {
    throw createError({ statusCode: 404, message: 'Invitation not found' })
  }

  // Check status
  if (invite.status !== 'pending') {
    throw createError({ statusCode: 410, message: 'Invitation is no longer valid' })
  }

  // Check if expired
  const now = Date.now()
  const expiresAt = invite.expiresAt instanceof Date ? invite.expiresAt.getTime() : invite.expiresAt
  if (expiresAt && expiresAt < now) {
    await db
      .update(mspOrgDelegationInvitations)
      .set({ status: 'expired' })
      .where(eq(mspOrgDelegationInvitations.id, invite.id))
    throw createError({ statusCode: 410, message: 'Invitation has expired' })
  }

  // Verify email matches
  if (auth.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    throw createError({ 
      statusCode: 403, 
      message: 'This invitation was sent to a different email address' 
    })
  }

  // Create the delegation
  const delegationId = createId()
  const nowDate = new Date()
  const permissionKeys = JSON.parse(invite.permissionKeys || '[]') as string[]
  const delegationExpiresAt = invite.delegationExpiresAt instanceof Date 
    ? invite.delegationExpiresAt 
    : (invite.delegationExpiresAt ? new Date(invite.delegationExpiresAt) : null)

  await db.insert(mspOrgDelegations).values({
    id: delegationId,
    orgId: invite.orgId,
    subjectType: 'user',
    subjectId: auth.user.id,
    createdBy: invite.invitedByUserId,
    expiresAt: delegationExpiresAt,
    note: invite.note,
    revokedAt: null,
    revokedBy: null,
    createdAt: nowDate,
    updatedAt: nowDate
  })

  // Add permissions
  if (permissionKeys.length > 0) {
    await db.insert(mspOrgDelegationPermissions).values(
      permissionKeys.map((permissionKey) => ({
        delegationId,
        permissionKey
      }))
    )
  }

  // Update invitation status
  await db
    .update(mspOrgDelegationInvitations)
    .set({
      status: 'accepted',
      acceptedAt: nowDate,
      delegationId
    })
    .where(eq(mspOrgDelegationInvitations.id, invite.id))

  // Log the action
  await logUserAction(event, 'DELEGATION_INVITE_ACCEPTED', {
    inviteId: invite.id,
    organizationId: invite.orgId,
    delegationId,
    permissionKeys
  }, auth.user.id)

  return {
    success: true,
    delegationId,
    message: 'Delegation activated'
  }
})
