/**
 * POST /api/admin/tenants/:tenantId/news/:postId/publish
 *
 * Publishes a news post (draft → published).
 */

import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantNewsPosts } from '../../../../../../database/schema'
import { getDb } from '../../../../../../utils/db'
import { requireTenantPermission } from '../../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../../utils/session'
import { logTenantAction } from '../../../../../../utils/audit'

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

  if (post.status === 'published') {
    throw createError({ statusCode: 400, message: 'News post is already published' })
  }

  const now = new Date()

  await db
    .update(tenantNewsPosts)
    .set({
      status: 'published',
      publishedAt: now,
      updatedAt: now,
      updatedByUserId: auth.user.id
    })
    .where(eq(tenantNewsPosts.id, postId))

  const [updatedPost] = await db.select().from(tenantNewsPosts).where(eq(tenantNewsPosts.id, postId))

  await logTenantAction(
    event,
    'NEWS_PUBLISHED',
    {
      postId,
      title: post.title
    },
    tenantId
  )

  return { post: updatedPost }
})

