/**
 * GET /api/admin/tenants/:tenantId/news/:postId
 *
 * Gets a single news post by ID.
 */

import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantNewsPosts, users } from '../../../../../../database/schema'
import { getDb } from '../../../../../../utils/db'
import { requireTenantPermission } from '../../../../../../utils/rbac'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const postId = getRouterParam(event, 'postId')

  if (!tenantId || !postId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID or post ID' })
  }

  await requireTenantPermission(event, 'tenants:read', tenantId)

  const db = getDb()

  const [post] = await db
    .select({
      id: tenantNewsPosts.id,
      sourceTenantId: tenantNewsPosts.sourceTenantId,
      title: tenantNewsPosts.title,
      slug: tenantNewsPosts.slug,
      summary: tenantNewsPosts.summary,
      heroImageUrl: tenantNewsPosts.heroImageUrl,
      bodyMarkdown: tenantNewsPosts.bodyMarkdown,
      status: tenantNewsPosts.status,
      publishedAt: tenantNewsPosts.publishedAt,
      createdAt: tenantNewsPosts.createdAt,
      updatedAt: tenantNewsPosts.updatedAt,
      createdByUserId: tenantNewsPosts.createdByUserId,
      createdByEmail: users.email,
      createdByName: users.fullName
    })
    .from(tenantNewsPosts)
    .leftJoin(users, eq(users.id, tenantNewsPosts.createdByUserId))
    .where(
      and(eq(tenantNewsPosts.id, postId), eq(tenantNewsPosts.sourceTenantId, tenantId))
    )
    .limit(1)

  if (!post) {
    throw createError({ statusCode: 404, message: 'News post not found' })
  }

  return {
    post: {
      ...post,
      createdBy: post.createdByUserId
        ? { id: post.createdByUserId, email: post.createdByEmail, fullName: post.createdByName }
        : null
    }
  }
})

