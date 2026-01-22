/**
 * POST /api/organizations/:orgId/incidents/:incidentId/archive
 *
 * Archive an organization incident.
 * Requires org:manage permission.
 */

import { eq, and, isNull } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantIncidents, organizations } from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { requirePermission } from '../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../utils/session'
import { logOrganizationAction } from '../../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const incidentId = getRouterParam(event, 'incidentId')
  
  if (!orgId || !incidentId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID or incident ID' })
  }

  await requirePermission(event, 'org:manage', orgId)
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()

  // Verify organization exists
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Get existing incident
  const [existingIncident] = await db
    .select()
    .from(tenantIncidents)
    .where(
      and(
        eq(tenantIncidents.id, incidentId),
        eq(tenantIncidents.sourceOrganizationId, orgId),
        isNull(tenantIncidents.deletedAt)
      )
    )
    .limit(1)

  if (!existingIncident) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  if (existingIncident.status === 'archived') {
    return { status: 'already_archived' }
  }

  const now = new Date()

  await db
    .update(tenantIncidents)
    .set({
      status: 'archived',
      updatedByUserId: auth.user.id,
      updatedAt: now
    })
    .where(eq(tenantIncidents.id, incidentId))

  await logOrganizationAction(
    event,
    'INCIDENT_ARCHIVED',
    {
      incidentId,
      title: existingIncident.title
    },
    orgId
  )

  return { status: 'ok' }
})

