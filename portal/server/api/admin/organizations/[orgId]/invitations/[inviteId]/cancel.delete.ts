import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { organizationInvitations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { parseOrgParam, requireOrganizationByIdentifier, requireOrganizationManageAccess } from '../../../utils'

export default defineEventHandler(async (event) => {
  const organization = await requireOrganizationByIdentifier(getDb(), parseOrgParam(event))
  
  // Validate access - allows superadmins and tenant admins
  await requireOrganizationManageAccess(event, organization)
  const inviteId = getRouterParam(event, 'inviteId')
  if (!inviteId) {
    throw createError({ statusCode: 400, message: 'Saknar inbjudnings-ID.' })
  }

  const [invitation] = await getDb()
    .select({
      id: organizationInvitations.id,
      organizationId: organizationInvitations.organizationId,
      status: organizationInvitations.status
    })
    .from(organizationInvitations)
    .where(and(eq(organizationInvitations.id, inviteId), eq(organizationInvitations.organizationId, organization.id)))

  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Inbjudan hittades inte.' })
  }
  if (invitation.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'Endast väntande inbjudningar kan avbrytas.' })
  }

  await getDb()
    .update(organizationInvitations)
    .set({ status: 'cancelled', declinedAt: new Date(), updatedAt: new Date() })
    .where(eq(organizationInvitations.id, inviteId))

  return { success: true }
})


