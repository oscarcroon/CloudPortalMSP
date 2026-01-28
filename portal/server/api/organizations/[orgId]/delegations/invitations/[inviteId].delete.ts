import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { mspOrgDelegationInvitations } from '~~/server/database/schema'
import { logUserAction } from '~~/server/utils/audit'

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
    throw createError({ statusCode: 400, message: 'Only pending invitations can be cancelled' })
  }

  // Update status to cancelled
  await db
    .update(mspOrgDelegationInvitations)
    .set({
      status: 'cancelled',
      updatedAt: new Date()
    })
    .where(eq(mspOrgDelegationInvitations.id, inviteId))

  // Log the action
  await logUserAction(event, 'DELEGATION_INVITE_CANCELLED', {
    inviteId,
    email: invite.email,
    organizationId: orgId
  })

  return {
    success: true,
    message: 'Invitation cancelled'
  }
})
