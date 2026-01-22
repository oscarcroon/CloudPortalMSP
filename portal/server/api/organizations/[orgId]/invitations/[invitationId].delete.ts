import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { organizationInvitations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'
import { findOrganizationByIdentifier } from '~~/server/api/admin/organizations/utils'
import { logUserAction } from '~~/server/utils/audit'

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

  await requirePermission(event, 'users:invite', organization.id)

  const [invitation] = await db.select({
    id: organizationInvitations.id, organizationId: organizationInvitations.organizationId,
    email: organizationInvitations.email, status: organizationInvitations.status
  }).from(organizationInvitations).where(and(eq(organizationInvitations.id, invitationId), eq(organizationInvitations.organizationId, organization.id)))

  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Invitation not found' })
  }

  if (invitation.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'Only pending invitations can be cancelled.' })
  }

  await db.update(organizationInvitations).set({ status: 'cancelled', declinedAt: new Date(), updatedAt: new Date() }).where(eq(organizationInvitations.id, invitationId))

  await logUserAction(event, 'INVITATION_CANCELLED', { inviteEmail: invitation.email, organizationId: organization.id, invitationId: invitation.id })

  return { success: true }
})
