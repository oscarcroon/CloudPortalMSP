/**
 * GET /api/admin/tenants/:tenantId/news
 *
 * Lists news posts for a tenant.
 * Query params:
 * - status: 'draft' | 'published' | 'archived' | 'all' (default: 'all')
 * - cursor: pagination cursor (last post ID)
 * - limit: items per page (default: 20)
 */

import { eq, and, desc, lt, or } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, getQuery } from 'h3'
import { tenantNewsPosts, tenants, users } from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { requireTenantPermission } from '../../../../../utils/rbac'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  await requireTenantPermission(event, 'tenants:read', tenantId)

  const query = getQuery(event)
  const status = (query.status as string) || 'all'
  const cursor = query.cursor as string | undefined
  const limit = Math.min(parseInt(query.limit as string) || 20, 100)

  const db = getDb()

  // Verify tenant exists
  const [tenant] = await db
    .select({ type: tenants.type })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  // Build query conditions
  const conditions = [eq(tenantNewsPosts.sourceTenantId, tenantId)]

  if (status !== 'all') {
    conditions.push(eq(tenantNewsPosts.status, status as 'draft' | 'published' | 'archived'))
  }

  // Cursor pagination
  if (cursor) {
    // Get the cursor post's createdAt for comparison
    const [cursorPost] = await db
      .select({ createdAt: tenantNewsPosts.createdAt })
      .from(tenantNewsPosts)
      .where(eq(tenantNewsPosts.id, cursor))
      .limit(1)

    if (cursorPost) {
      conditions.push(lt(tenantNewsPosts.createdAt, cursorPost.createdAt))
    }
  }

  const posts = await db
    .select({
      id: tenantNewsPosts.id,
      title: tenantNewsPosts.title,
      slug: tenantNewsPosts.slug,
      summary: tenantNewsPosts.summary,
      heroImageUrl: tenantNewsPosts.heroImageUrl,
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
    .where(and(...conditions))
    .orderBy(desc(tenantNewsPosts.createdAt))
    .limit(limit + 1)

  // Check if there are more items
  const hasMore = posts.length > limit
  const items = hasMore ? posts.slice(0, limit) : posts
  const nextCursor = hasMore ? items[items.length - 1]?.id : null

  return {
    posts: items.map((p) => ({
      ...p,
      createdBy: p.createdByUserId
        ? { id: p.createdByUserId, email: p.createdByEmail, fullName: p.createdByName }
        : null
    })),
    nextCursor,
    tenantType: tenant.type
  }
})

