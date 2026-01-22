/**
 * POST /api/organizations/{orgId}/setup/set-default-group
 * 
 * Sets the default group for new members joining the organization.
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizations, orgGroups } from '~~/server/database/schema'

const bodySchema = z.object({
  groupId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const body = bodySchema.parse(await readBody(event))
  const db = getDb()

  // Verify the group exists and belongs to this organization
  const [group] = await db
    .select({ id: orgGroups.id })
    .from(orgGroups)
    .where(
      and(
        eq(orgGroups.id, body.groupId),
        eq(orgGroups.organizationId, orgId)
      )
    )
    .limit(1)

  if (!group) {
    throw createError({ statusCode: 404, message: 'Group not found in this organization' })
  }

  // Update organization with default group
  await db
    .update(organizations)
    .set({ defaultGroupId: body.groupId })
    .where(eq(organizations.id, orgId))

  console.log(`[set-default-group] Set default group for org ${orgId} to ${body.groupId}`)

  return {
    success: true,
    defaultGroupId: body.groupId
  }
})
