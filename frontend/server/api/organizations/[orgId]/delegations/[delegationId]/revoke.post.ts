import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { mspOrgDelegations, organizations } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const delegationId = getRouterParam(event, 'delegationId')
  if (!orgId || !delegationId) {
    throw createError({ statusCode: 400, message: 'Missing orgId or delegationId' })
  }

  // Require org:manage permission for the organization
  await requirePermission(event, 'org:manage', orgId)

  const db = getDb()
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

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

