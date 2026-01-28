import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { mspOrgDelegations } from '~~/server/database/schema'
import { requireOrganizationByIdentifier, requireOrganizationManageAccess } from '../../../utils'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const delegationId = getRouterParam(event, 'delegationId')
  if (!orgId || !delegationId) {
    throw createError({ statusCode: 400, message: 'Missing orgId or delegationId' })
  }

  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgId)
  
  // Validate access - allows superadmins and tenant admins
  await requireOrganizationManageAccess(event, organization)
  const [existing] = await db
    .select()
    .from(mspOrgDelegations)
    .where(eq(mspOrgDelegations.id, delegationId))

  if (!existing || existing.orgId !== organization.id) {
    throw createError({ statusCode: 404, message: 'Delegation not found' })
  }

  const now = new Date()
  await db
    .update(mspOrgDelegations)
    .set({ revokedAt: now })
    .where(eq(mspOrgDelegations.id, delegationId))

  return { id: delegationId, revokedAt: now.getTime() }
})



