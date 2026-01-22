/**
 * GET /api/organizations/:orgId/incidents
 *
 * Lists internal incidents for an organization.
 * Only organization members can view incidents.
 * Query params:
 * - filter: 'active' | 'all' | 'archived' (default: 'active')
 * - includeDeleted: 'true' | 'false' (default: 'false', superadmin only)
 */

import { eq, and, isNull, desc, ne } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, getQuery } from 'h3'
import { tenantIncidents, organizations, users } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requirePermission } from '../../../../utils/rbac'
import { ensureAuthState } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  // Require at least org:read permission
  await requirePermission(event, 'org:read', orgId)
  const auth = await ensureAuthState(event)

  const query = getQuery(event)
  const filter = (query.filter as string) || 'active'
  const includeDeleted = query.includeDeleted === 'true' && auth?.user.isSuperAdmin

  const db = getDb()

  // Verify organization exists
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Build query conditions for organization-specific incidents
  const conditions = [eq(tenantIncidents.sourceOrganizationId, orgId)]

  if (!includeDeleted) {
    conditions.push(isNull(tenantIncidents.deletedAt))
  }

  if (filter === 'active') {
    conditions.push(eq(tenantIncidents.status, 'active'))
  } else if (filter === 'archived') {
    conditions.push(eq(tenantIncidents.status, 'archived'))
  } else if (filter === 'all') {
    // 'all' filter excludes archived by default for cleaner list
    conditions.push(ne(tenantIncidents.status, 'archived'))
  }

  const incidents = await db
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
      updatedAt: tenantIncidents.updatedAt,
      deletedAt: tenantIncidents.deletedAt,
      createdByUserId: tenantIncidents.createdByUserId,
      createdByEmail: users.email,
      createdByName: users.fullName
    })
    .from(tenantIncidents)
    .leftJoin(users, eq(users.id, tenantIncidents.createdByUserId))
    .where(and(...conditions))
    .orderBy(desc(tenantIncidents.createdAt))

  return {
    incidents: incidents.map((i) => ({
      ...i,
      createdBy: i.createdByUserId
        ? { id: i.createdByUserId, email: i.createdByEmail, fullName: i.createdByName }
        : null
    })),
    organizationName: org.name
  }
})

