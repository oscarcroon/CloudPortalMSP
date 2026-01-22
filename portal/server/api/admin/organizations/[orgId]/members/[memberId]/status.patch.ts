import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { getDb } from '../../../../../../utils/db'
import {
  assertOwnerWillRemain,
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess
} from '../../../utils'
import { organizationMemberships } from '../../../../../../database/schema'
import { fetchMemberPayload } from '../helpers'

export const statusSchema = z.object({
  status: z.enum(['active', 'suspended'])
})

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const memberParam = parseOrgParam(event, 'memberId')
  const { status } = statusSchema.parse(await readBody(event))
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - allows superadmins and tenant admins
  await requireOrganizationManageAccess(event, organization)

  const [membership] = await db
    .select({
      id: organizationMemberships.id,
      organizationId: organizationMemberships.organizationId,
      role: organizationMemberships.role,
      status: organizationMemberships.status
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.id, memberParam))

  if (!membership || membership.organizationId !== organization.id) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  if (!['active', 'suspended'].includes(membership.status)) {
    throw createError({
      statusCode: 400,
      message: 'Status kan endast ändras för aktiva eller avstängda medlemmar.'
    })
  }

  if (membership.status === status) {
    return fetchMemberPayload(db, membership.id)
  }

  if (membership.role === 'owner' && status === 'suspended' && membership.status === 'active') {
    await assertOwnerWillRemain(db, organization.id, membership.id)
  }

  await db
    .update(organizationMemberships)
    .set({ status })
    .where(eq(organizationMemberships.id, membership.id))

  return fetchMemberPayload(db, membership.id)
})


