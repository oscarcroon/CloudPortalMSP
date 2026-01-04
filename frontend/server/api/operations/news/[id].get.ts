/**
 * GET /api/operations/news/:id
 *
 * Returns a single news post if it's accessible from the current context.
 * Supports lookup by either slug or ID.
 * Context-aware: Only returns news from tenants the user has access to.
 */

import { eq, and, inArray, lte, or, isNull, gt, lt, asc, desc, ne } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantNewsPosts, tenants } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { ensureAuthState } from '../../../utils/session'
import { getUpstreamSources } from '../../../utils/operations/upstreamSources'

export default defineEventHandler(async (event) => {
  const identifier = getRouterParam(event, 'id')
  if (!identifier) {
    throw createError({ statusCode: 400, message: 'Missing post identifier' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const currentOrgId = auth.currentOrgId ?? null
  const currentTenantId = auth.currentTenantId ?? null

  // Get upstream sources for the current context
  const sources = await getUpstreamSources({
    currentOrgId,
    currentTenantId
  })

  if (sources.sourceIds.length === 0) {
    throw createError({ statusCode: 404, message: 'News post not found' })
  }

  const db = getDb()
  const now = new Date()

  // Determine if identifier is a slug (contains only lowercase letters, numbers, and dashes)
  // or a CUID (typically starts with letters and contains mix of chars)
  const isSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identifier)

  // Build the identifier condition - try slug first if it looks like a slug
  const identifierCondition = isSlug
    ? eq(tenantNewsPosts.slug, identifier)
    : eq(tenantNewsPosts.id, identifier)

  // Fetch the news post, ensuring it's from an allowed source tenant
  let [post] = await db
    .select({
      id: tenantNewsPosts.id,
      title: tenantNewsPosts.title,
      slug: tenantNewsPosts.slug,
      summary: tenantNewsPosts.summary,
      heroImageUrl: tenantNewsPosts.heroImageUrl,
      bodyMarkdown: tenantNewsPosts.bodyMarkdown,
      status: tenantNewsPosts.status,
      publishedAt: tenantNewsPosts.publishedAt,
      createdAt: tenantNewsPosts.createdAt,
      sourceTenantId: tenantNewsPosts.sourceTenantId,
      sourceTenantName: tenants.name,
      sourceTenantType: tenants.type
    })
    .from(tenantNewsPosts)
    .innerJoin(tenants, eq(tenants.id, tenantNewsPosts.sourceTenantId))
    .where(
      and(
        identifierCondition,
        // Must be from an allowed source tenant
        inArray(tenantNewsPosts.sourceTenantId, sources.sourceIds),
        // Must be published
        eq(tenantNewsPosts.status, 'published'),
        // publishedAt must be in the past or null
        or(isNull(tenantNewsPosts.publishedAt), lte(tenantNewsPosts.publishedAt, now))
      )
    )
    .limit(1)

  // If not found and we tried slug, fallback to ID lookup
  if (!post && isSlug) {
    [post] = await db
      .select({
        id: tenantNewsPosts.id,
        title: tenantNewsPosts.title,
        slug: tenantNewsPosts.slug,
        summary: tenantNewsPosts.summary,
        heroImageUrl: tenantNewsPosts.heroImageUrl,
        bodyMarkdown: tenantNewsPosts.bodyMarkdown,
        status: tenantNewsPosts.status,
        publishedAt: tenantNewsPosts.publishedAt,
        createdAt: tenantNewsPosts.createdAt,
        sourceTenantId: tenantNewsPosts.sourceTenantId,
        sourceTenantName: tenants.name,
        sourceTenantType: tenants.type
      })
      .from(tenantNewsPosts)
      .innerJoin(tenants, eq(tenants.id, tenantNewsPosts.sourceTenantId))
      .where(
        and(
          eq(tenantNewsPosts.id, identifier),
          inArray(tenantNewsPosts.sourceTenantId, sources.sourceIds),
          eq(tenantNewsPosts.status, 'published'),
          or(isNull(tenantNewsPosts.publishedAt), lte(tenantNewsPosts.publishedAt, now))
        )
      )
      .limit(1)
  }

  if (!post) {
    throw createError({ statusCode: 404, message: 'News post not found' })
  }

  // Prev/Next navigation within the same effective context (same allowed source tenants)
  // Ordering: publishedAt DESC (newest first)
  // - previous: the nearest newer post (publishedAt > current)
  // - next: the nearest older post (publishedAt < current)
  const currentPublishedAt = post.publishedAt ?? post.createdAt

  const baseNavConditions = [
    inArray(tenantNewsPosts.sourceTenantId, sources.sourceIds),
    eq(tenantNewsPosts.status, 'published'),
    or(isNull(tenantNewsPosts.publishedAt), lte(tenantNewsPosts.publishedAt, now)),
    ne(tenantNewsPosts.id, post.id)
  ] as const

  const [previous] = await db
    .select({
      id: tenantNewsPosts.id,
      title: tenantNewsPosts.title,
      slug: tenantNewsPosts.slug
    })
    .from(tenantNewsPosts)
    .where(and(...baseNavConditions, gt(tenantNewsPosts.publishedAt, currentPublishedAt)))
    .orderBy(asc(tenantNewsPosts.publishedAt))
    .limit(1)

  const [next] = await db
    .select({
      id: tenantNewsPosts.id,
      title: tenantNewsPosts.title,
      slug: tenantNewsPosts.slug
    })
    .from(tenantNewsPosts)
    .where(and(...baseNavConditions, lt(tenantNewsPosts.publishedAt, currentPublishedAt)))
    .orderBy(desc(tenantNewsPosts.publishedAt))
    .limit(1)

  return {
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      heroImageUrl: post.heroImageUrl,
      bodyMarkdown: post.bodyMarkdown,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      sourceTenant: {
        id: post.sourceTenantId,
        name: post.sourceTenantName,
        type: post.sourceTenantType
      }
    },
    navigation: {
      previous: previous ? { title: previous.title, slug: previous.slug } : null,
      next: next ? { title: next.title, slug: next.slug } : null
    }
  }
})

