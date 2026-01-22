/**
 * GET /api/organizations/:orgId/incidents/:incidentId
 *
 * Get a single organization incident by ID.
 */

import { eq, and, isNull } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantIncidents, organizations, users } from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { requirePermission } from '../../../../../utils/rbac'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const incidentId = getRouterParam(event, 'incidentId')
  
  if (!orgId || !incidentId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID or incident ID' })
  }

  await requirePermission(event, 'org:read', orgId)

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

  // Get incident
  const [incident] = await db
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
      createdByUserId: tenantIncidents.createdByUserId,
      createdByEmail: users.email,
      createdByName: users.fullName
    })
    .from(tenantIncidents)
    .leftJoin(users, eq(users.id, tenantIncidents.createdByUserId))
    .where(
      and(
        eq(tenantIncidents.id, incidentId),
        eq(tenantIncidents.sourceOrganizationId, orgId),
        isNull(tenantIncidents.deletedAt)
      )
    )
    .limit(1)

  if (!incident) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  return {
    incident: {
      ...incident,
      createdBy: incident.createdByUserId
        ? { id: incident.createdByUserId, email: incident.createdByEmail, fullName: incident.createdByName }
        : null
    },
    organizationName: org.name
  }
})

