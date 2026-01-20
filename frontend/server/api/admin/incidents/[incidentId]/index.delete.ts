/**
 * DELETE /api/admin/incidents/:incidentId
 *
 * Soft-deletes an incident from history.
 * Superadmin only.
 */

import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantIncidents } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { ensureAuthState } from '../../../../utils/session'
import { logTenantAction } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const incidentId = getRouterParam(event, 'incidentId')
  if (!incidentId) {
    throw createError({ statusCode: 400, message: 'Missing incident ID' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  // Superadmin only
  if (!auth.user.isSuperAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Only superadmins can delete incidents from history'
    })
  }

  const db = getDb()

  // Find the incident
  const [incident] = await db
    .select()
    .from(tenantIncidents)
    .where(eq(tenantIncidents.id, incidentId))
    .limit(1)

  if (!incident) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  if (incident.deletedAt) {
    throw createError({ statusCode: 410, message: 'Incident already deleted' })
  }

  const now = new Date()

  // Soft delete
  await db
    .update(tenantIncidents)
    .set({
      deletedAt: now,
      deletedByUserId: auth.user.id,
      updatedAt: now
    })
    .where(eq(tenantIncidents.id, incidentId))

  await logTenantAction(
    event,
    'INCIDENT_DELETED',
    {
      incidentId,
      incidentTitle: incident.title,
      severity: incident.severity,
      status: incident.status
    },
    incident.sourceTenantId
  )

  return { success: true, deleted: true }
})

