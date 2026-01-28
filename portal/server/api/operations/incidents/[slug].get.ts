/**
 * GET /api/operations/incidents/:slug
 *
 * Returns a single incident if it's accessible from the current context.
 * Supports lookup by either slug or ID.
 * Context-aware: Only returns incidents from tenants the user has access to.
 */

import { eq, and, inArray, lte, or, isNull, gt, lt, asc, desc, ne } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantIncidents, tenants } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { ensureAuthState } from '../../../utils/session'
import { getUpstreamSources } from '../../../utils/operations/upstreamSources'

export default defineEventHandler(async (event) => {
  const identifier = getRouterParam(event, 'slug')
  if (!identifier) {
    throw createError({ statusCode: 400, message: 'Missing incident identifier' })
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
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  const db = getDb()

  // Determine if identifier is a slug (contains only lowercase letters, numbers, and dashes)
  // or a CUID (typically starts with letters and contains mix of chars)
  const isSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identifier)

  // Build the identifier condition - try slug first if it looks like a slug
  const identifierCondition = isSlug
    ? eq(tenantIncidents.slug, identifier)
    : eq(tenantIncidents.id, identifier)

  // Fetch the incident, ensuring it's from an allowed source tenant
  let [incident] = await db
    .select({
      id: tenantIncidents.id,
      title: tenantIncidents.title,
      slug: tenantIncidents.slug,
      bodyMarkdown: tenantIncidents.bodyMarkdown,
      severity: tenantIncidents.severity,
      status: tenantIncidents.status,
      startsAt: tenantIncidents.startsAt,
      endsAt: tenantIncidents.endsAt,
      resolvedAt: tenantIncidents.resolvedAt,
      createdAt: tenantIncidents.createdAt,
      sourceTenantId: tenantIncidents.sourceTenantId,
      sourceTenantName: tenants.name,
      sourceTenantType: tenants.type
    })
    .from(tenantIncidents)
    .innerJoin(tenants, eq(tenants.id, tenantIncidents.sourceTenantId))
    .where(
      and(
        identifierCondition,
        // Must be from an allowed source tenant
        inArray(tenantIncidents.sourceTenantId, sources.sourceIds),
        // Must not be deleted
        isNull(tenantIncidents.deletedAt)
      )
    )
    .limit(1)

  // If not found and we tried slug, fallback to ID lookup
  if (!incident && isSlug) {
    [incident] = await db
      .select({
        id: tenantIncidents.id,
        title: tenantIncidents.title,
        slug: tenantIncidents.slug,
        bodyMarkdown: tenantIncidents.bodyMarkdown,
        severity: tenantIncidents.severity,
        status: tenantIncidents.status,
        startsAt: tenantIncidents.startsAt,
        endsAt: tenantIncidents.endsAt,
        resolvedAt: tenantIncidents.resolvedAt,
        createdAt: tenantIncidents.createdAt,
        sourceTenantId: tenantIncidents.sourceTenantId,
        sourceTenantName: tenants.name,
        sourceTenantType: tenants.type
      })
      .from(tenantIncidents)
      .innerJoin(tenants, eq(tenants.id, tenantIncidents.sourceTenantId))
      .where(
        and(
          eq(tenantIncidents.id, identifier),
          inArray(tenantIncidents.sourceTenantId, sources.sourceIds),
          isNull(tenantIncidents.deletedAt)
        )
      )
      .limit(1)
  }

  if (!incident) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  // Prev/Next navigation within the same effective context (same allowed source tenants)
  // Ordering: createdAt DESC (newest first)
  const currentCreatedAt = incident.createdAt

  const baseNavConditions = [
    inArray(tenantIncidents.sourceTenantId, sources.sourceIds),
    isNull(tenantIncidents.deletedAt),
    ne(tenantIncidents.id, incident.id)
  ] as const

  const [previous] = await db
    .select({
      id: tenantIncidents.id,
      title: tenantIncidents.title,
      slug: tenantIncidents.slug
    })
    .from(tenantIncidents)
    .where(and(...baseNavConditions, gt(tenantIncidents.createdAt, currentCreatedAt)))
    .orderBy(asc(tenantIncidents.createdAt))
    .limit(1)

  const [next] = await db
    .select({
      id: tenantIncidents.id,
      title: tenantIncidents.title,
      slug: tenantIncidents.slug
    })
    .from(tenantIncidents)
    .where(and(...baseNavConditions, lt(tenantIncidents.createdAt, currentCreatedAt)))
    .orderBy(desc(tenantIncidents.createdAt))
    .limit(1)

  return {
    incident: {
      id: incident.id,
      title: incident.title,
      slug: incident.slug,
      bodyMarkdown: incident.bodyMarkdown,
      severity: incident.severity,
      status: incident.status,
      startsAt: incident.startsAt,
      endsAt: incident.endsAt,
      resolvedAt: incident.resolvedAt,
      createdAt: incident.createdAt,
      sourceTenant: {
        id: incident.sourceTenantId,
        name: incident.sourceTenantName,
        type: incident.sourceTenantType
      }
    },
    navigation: {
      previous: previous ? { title: previous.title, slug: previous.slug } : null,
      next: next ? { title: next.title, slug: next.slug } : null
    }
  }
})

