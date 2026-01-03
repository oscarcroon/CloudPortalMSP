/**
 * PUT /api/admin/tenants/:tenantId/incidents/:incidentId
 *
 * Updates an existing incident.
 * Can also resolve/reactivate incidents via status field.
 */

import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { tenantIncidents } from '../../../../../../database/schema'
import { getDb } from '../../../../../../utils/db'
import { requireTenantPermission } from '../../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../../utils/session'
import { logTenantAction } from '../../../../../../utils/audit'

const updateIncidentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  bodyMarkdown: z.string().max(10000).optional().nullable(),
  severity: z.enum(['critical', 'outage', 'notice', 'maintenance']).optional(),
  status: z.enum(['active', 'resolved']).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable()
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const incidentId = getRouterParam(event, 'incidentId')

  if (!tenantId || !incidentId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID or incident ID' })
  }

  await requireTenantPermission(event, 'tenants:manage', tenantId)
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()

  // Find the incident and verify ownership
  const [incident] = await db
    .select()
    .from(tenantIncidents)
    .where(and(eq(tenantIncidents.id, incidentId), eq(tenantIncidents.sourceTenantId, tenantId)))
    .limit(1)

  if (!incident) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  if (incident.deletedAt) {
    throw createError({ statusCode: 410, message: 'Incident has been deleted' })
  }

  const payload = updateIncidentSchema.parse(await readBody(event))
  const now = new Date()

  const updates: Partial<typeof tenantIncidents.$inferInsert> = {
    updatedAt: now,
    updatedByUserId: auth.user.id
  }

  if (payload.title !== undefined) updates.title = payload.title
  if (payload.bodyMarkdown !== undefined) updates.bodyMarkdown = payload.bodyMarkdown
  if (payload.severity !== undefined) updates.severity = payload.severity
  if (payload.startsAt !== undefined) {
    updates.startsAt = payload.startsAt ? new Date(payload.startsAt) : null
  }
  if (payload.endsAt !== undefined) {
    updates.endsAt = payload.endsAt ? new Date(payload.endsAt) : null
  }

  // Handle status change
  if (payload.status !== undefined && payload.status !== incident.status) {
    updates.status = payload.status
    if (payload.status === 'resolved') {
      updates.resolvedAt = now
    } else {
      updates.resolvedAt = null
    }
  }

  await db.update(tenantIncidents).set(updates).where(eq(tenantIncidents.id, incidentId))

  const [updatedIncident] = await db
    .select()
    .from(tenantIncidents)
    .where(eq(tenantIncidents.id, incidentId))

  await logTenantAction(
    event,
    'INCIDENT_UPDATED',
    {
      incidentId,
      changes: payload,
      statusChange: payload.status !== incident.status ? { from: incident.status, to: payload.status } : null
    },
    tenantId
  )

  return { incident: updatedIncident }
})

