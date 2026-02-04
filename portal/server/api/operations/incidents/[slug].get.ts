/**
 * GET /api/operations/incidents/:slug
 *
 * Returns a single incident if it's accessible from the current context.
 * Supports lookup by either slug or ID.
 * Context-aware: Returns incidents from upstream tenants or the current organization.
 */

import { eq, and, inArray, or, isNull, gt, lt, asc, desc, ne } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantIncidents, tenants, organizations } from '../../../database/schema'
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

  const hasOrgContext = Boolean(currentOrgId)

  if (sources.sourceIds.length === 0 && !hasOrgContext) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  const db = getDb()

  // Determine if identifier is a slug or a CUID
  const isSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identifier)

  // Build the identifier condition
  const identifierCondition = isSlug
    ? eq(tenantIncidents.slug, identifier)
    : eq(tenantIncidents.id, identifier)

  // Build source access conditions: tenant sources OR organization source
  const sourceConditions = []
  if (sources.sourceIds.length > 0) {
    sourceConditions.push(inArray(tenantIncidents.sourceTenantId, sources.sourceIds))
  }
  if (currentOrgId) {
    sourceConditions.push(eq(tenantIncidents.sourceOrganizationId, currentOrgId))
  }

  if (sourceConditions.length === 0) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  // Use LEFT JOINs since incidents can be sourced from either a tenant or an organization
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
      sourceOrganizationId: tenantIncidents.sourceOrganizationId,
      sourceTenantName: tenants.name,
      sourceTenantType: tenants.type,
      sourceOrgName: organizations.name
    })
    .from(tenantIncidents)
    .leftJoin(tenants, eq(tenants.id, tenantIncidents.sourceTenantId))
    .leftJoin(organizations, eq(organizations.id, tenantIncidents.sourceOrganizationId))
    .where(
      and(
        identifierCondition,
        or(...sourceConditions),
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
        sourceOrganizationId: tenantIncidents.sourceOrganizationId,
        sourceTenantName: tenants.name,
        sourceTenantType: tenants.type,
        sourceOrgName: organizations.name
      })
      .from(tenantIncidents)
      .leftJoin(tenants, eq(tenants.id, tenantIncidents.sourceTenantId))
      .leftJoin(organizations, eq(organizations.id, tenantIncidents.sourceOrganizationId))
      .where(
        and(
          eq(tenantIncidents.id, identifier),
          or(...sourceConditions),
          isNull(tenantIncidents.deletedAt)
        )
      )
      .limit(1)
  }

  if (!incident) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  // Resolve source info: either from tenant or from organization
  let sourceId: string
  let sourceName: string
  let sourceType: 'provider' | 'distributor' | 'organization'

  if (incident.sourceOrganizationId && incident.sourceOrgName) {
    sourceId = incident.sourceOrganizationId
    sourceName = incident.sourceOrgName
    sourceType = 'organization'
  } else {
    sourceId = incident.sourceTenantId ?? ''
    sourceName = incident.sourceTenantName ?? 'Unknown'
    sourceType = (incident.sourceTenantType as 'provider' | 'distributor') ?? 'provider'
  }

  // Prev/Next navigation within the same effective context
  const currentCreatedAt = incident.createdAt

  const baseNavConditions = [
    or(...sourceConditions),
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
        id: sourceId,
        name: sourceName,
        type: sourceType
      }
    },
    navigation: {
      previous: previous ? { title: previous.title, slug: previous.slug } : null,
      next: next ? { title: next.title, slug: next.slug } : null
    }
  }
})
