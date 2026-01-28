/**
 * PUT /api/organizations/:orgId/incidents/:incidentId
 *
 * Update an organization incident.
 * Requires org:manage permission.
 */

import { eq, and, isNull } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { tenantIncidents, organizations } from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { requirePermission } from '../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../utils/session'
import { logOrganizationAction } from '../../../../../utils/audit'

const updateIncidentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  bodyMarkdown: z.string().max(10000).optional().nullable(),
  severity: z.enum(['critical', 'outage', 'notice', 'maintenance', 'planned']).optional(),
  status: z.enum(['active', 'resolved', 'archived']).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable()
})

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

  const payload = updateIncidentSchema.parse(await readBody(event))
  const now = new Date()

  const updateData: Record<string, any> = {
    updatedByUserId: auth.user.id,
    updatedAt: now
  }

  if (payload.title !== undefined) updateData.title = payload.title
  if (payload.bodyMarkdown !== undefined) updateData.bodyMarkdown = payload.bodyMarkdown
  if (payload.severity !== undefined) updateData.severity = payload.severity
  if (payload.status !== undefined) {
    updateData.status = payload.status
    if (payload.status === 'resolved') {
      updateData.resolvedAt = now
    }
  }
  if (payload.startsAt !== undefined) {
    updateData.startsAt = payload.startsAt ? new Date(payload.startsAt) : null
  }
  if (payload.endsAt !== undefined) {
    updateData.endsAt = payload.endsAt ? new Date(payload.endsAt) : null
  }

  await db
    .update(tenantIncidents)
    .set(updateData)
    .where(eq(tenantIncidents.id, incidentId))

  const [updatedIncident] = await db
    .select()
    .from(tenantIncidents)
    .where(eq(tenantIncidents.id, incidentId))

  await logOrganizationAction(
    event,
    'INCIDENT_UPDATED',
    {
      incidentId,
      changes: payload
    },
    orgId
  )

  return { incident: updatedIncident }
})

