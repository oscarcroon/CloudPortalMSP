/**
 * PUT /api/admin/tenants/:tenantId/news/:postId
 *
 * Updates an existing news post.
 */

import { eq, and, ne } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { tenantNewsPosts } from '../../../../../../database/schema'
import { getDb } from '../../../../../../utils/db'
import { requireTenantPermission } from '../../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../../utils/session'
import { logTenantAction } from '../../../../../../utils/audit'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const updateNewsSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(slugRegex, 'Slug måste vara lowercase och får endast innehålla bindestreck.')
    .optional(),
  summary: z.string().max(500).optional().nullable(),
  bodyMarkdown: z.string().max(50000).optional().nullable(),
  heroImageUrl: z.string().url().max(2000).optional().nullable()
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const postId = getRouterParam(event, 'postId')

  if (!tenantId || !postId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID or post ID' })
  }

  await requireTenantPermission(event, 'tenants:manage', tenantId)
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()

  // Find the post and verify ownership
  const [post] = await db
    .select()
    .from(tenantNewsPosts)
    .where(and(eq(tenantNewsPosts.id, postId), eq(tenantNewsPosts.sourceTenantId, tenantId)))
    .limit(1)

  if (!post) {
    throw createError({ statusCode: 404, message: 'News post not found' })
  }

  const payload = updateNewsSchema.parse(await readBody(event))
  const now = new Date()

  const updates: Partial<typeof tenantNewsPosts.$inferInsert> = {
    updatedAt: now,
    updatedByUserId: auth.user.id
  }

  if (payload.title !== undefined) updates.title = payload.title
  if (payload.summary !== undefined) updates.summary = payload.summary
  if (payload.bodyMarkdown !== undefined) updates.bodyMarkdown = payload.bodyMarkdown
  if (payload.heroImageUrl !== undefined) updates.heroImageUrl = payload.heroImageUrl

  // Handle slug change with uniqueness check
  if (payload.slug !== undefined && payload.slug !== post.slug) {
    const [existingSlug] = await db
      .select({ id: tenantNewsPosts.id })
      .from(tenantNewsPosts)
      .where(
        and(
          eq(tenantNewsPosts.sourceTenantId, tenantId),
          eq(tenantNewsPosts.slug, payload.slug),
          ne(tenantNewsPosts.id, postId)
        )
      )
      .limit(1)

    if (existingSlug) {
      throw createError({
        statusCode: 400,
        message: 'A news post with this slug already exists'
      })
    }

    updates.slug = payload.slug
  }

  await db.update(tenantNewsPosts).set(updates).where(eq(tenantNewsPosts.id, postId))

  const [updatedPost] = await db.select().from(tenantNewsPosts).where(eq(tenantNewsPosts.id, postId))

  await logTenantAction(
    event,
    'NEWS_UPDATED',
    {
      postId,
      changes: payload
    },
    tenantId
  )

  return { post: updatedPost }
})

