import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'
import { getDb } from '../../../../../../utils/db'
import { requireSuperAdmin } from '../../../../../../utils/rbac'
import {
  assertOwnerWillRemain,
  parseOrgParam,
  requireOrganizationByIdentifier
} from '../../../utils'
import { organizationMemberships } from '../../../../../../database/schema'
import { fetchMemberPayload } from '../helpers'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const memberParam = parseOrgParam(event, 'memberId')
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)

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

  if (membership.role === 'owner' && membership.status === 'active') {
    await assertOwnerWillRemain(db, organization.id, membership.id)
  }

  const payload = await fetchMemberPayload(db, membership.id)

  await db.delete(organizationMemberships).where(eq(organizationMemberships.id, membership.id))

  return payload
})

