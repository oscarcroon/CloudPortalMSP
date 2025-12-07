import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroups } from '~~/server/database/schema'

const bodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const groupId = getRouterParam(event, 'groupId')

  if (!orgId || !groupId) {
    throw createError({ statusCode: 400, message: 'Missing organization or group ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const body = bodySchema.parse(await readBody(event))
  if (!body.name && body.description === undefined) {
    throw createError({ statusCode: 400, message: 'Inget att uppdatera' })
  }

  const db = getDb()
  const [existing] = await db
    .select({ id: orgGroups.id })
    .from(orgGroups)
    .where(and(eq(orgGroups.id, groupId), eq(orgGroups.organizationId, orgId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Gruppen kunde inte hittas' })
  }

  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date()
  }
  if (body.name) updatePayload.name = body.name.trim()
  if (body.description !== undefined) updatePayload.description = body.description?.trim() || null

  await db
    .update(orgGroups)
    .set(updatePayload as any)
    .where(and(eq(orgGroups.id, groupId), eq(orgGroups.organizationId, orgId)))

  return {
    organizationId: orgId,
    group: {
      id: groupId,
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {})
    }
  }
})


