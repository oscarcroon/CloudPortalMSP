/**
 * GET /api/operations/news
 *
 * Returns paginated news posts accessible from the current context.
 * Context-aware: Only returns news from tenants the user has access to.
 *
 * Query params:
 * - limit: number of items per page (default: 10, max: 50)
 * - cursor: pagination cursor (ID of last item from previous page)
 */

import { eq, and, inArray, lte, or, isNull, lt, desc } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery } from 'h3'
import { tenantNewsPosts, tenants } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { ensureAuthState } from '../../../utils/session'
import { getUpstreamSources } from '../../../utils/operations/upstreamSources'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const limit = Math.min(Math.max(1, parseInt(query.limit as string) || 10), 50)
  const cursor = query.cursor as string | undefined

  const currentOrgId = auth.currentOrgId ?? null
  const currentTenantId = auth.currentTenantId ?? null

  // Get upstream sources for the current context
  const sources = await getUpstreamSources({
    currentOrgId,
    currentTenantId
  })

  if (sources.sourceIds.length === 0) {
    return {
      posts: [],
      nextCursor: null,
      hasMore: false
    }
  }

  const db = getDb()
  const now = new Date()

  // Build base conditions
  const baseConditions = [
    inArray(tenantNewsPosts.sourceTenantId, sources.sourceIds),
    eq(tenantNewsPosts.status, 'published'),
    or(isNull(tenantNewsPosts.publishedAt), lte(tenantNewsPosts.publishedAt, now))
  ]

  // Add cursor condition if provided
  if (cursor) {
    // Get the cursor post's publishedAt for comparison
    const [cursorPost] = await db
      .select({ publishedAt: tenantNewsPosts.publishedAt })
      .from(tenantNewsPosts)
      .where(eq(tenantNewsPosts.id, cursor))
      .limit(1)

    if (cursorPost?.publishedAt) {
      baseConditions.push(lt(tenantNewsPosts.publishedAt, cursorPost.publishedAt))
    }
  }

  // Fetch posts with one extra to check for more
  const posts = await db
    .select({
      id: tenantNewsPosts.id,
      title: tenantNewsPosts.title,
      slug: tenantNewsPosts.slug,
      summary: tenantNewsPosts.summary,
      heroImageUrl: tenantNewsPosts.heroImageUrl,
      publishedAt: tenantNewsPosts.publishedAt,
      sourceTenantId: tenantNewsPosts.sourceTenantId,
      sourceTenantName: tenants.name,
      sourceTenantType: tenants.type
    })
    .from(tenantNewsPosts)
    .innerJoin(tenants, eq(tenants.id, tenantNewsPosts.sourceTenantId))
    .where(and(...baseConditions))
    .orderBy(desc(tenantNewsPosts.publishedAt))
    .limit(limit + 1)

  const hasMore = posts.length > limit
  const items = hasMore ? posts.slice(0, limit) : posts
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null

  return {
    posts: items.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      heroImageUrl: post.heroImageUrl,
      publishedAt: post.publishedAt,
      sourceTenant: {
        id: post.sourceTenantId,
        name: post.sourceTenantName,
        type: post.sourceTenantType
      }
    })),
    nextCursor,
    hasMore
  }
})

