/**
 * POST /api/operations/incidents/:incidentId/unmute
 *
 * Removes a personal mute for the current user on an incident.
 * This makes the incident visible again for the current user.
 */

import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantIncidents, tenantIncidentUserMutes } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { ensureAuthState } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  const incidentId = getRouterParam(event, 'incidentId')
  if (!incidentId) {
    throw createError({ statusCode: 400, message: 'Missing incident ID' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()
  const userId = auth.user.id

  // Verify incident exists
  const [incident] = await db
    .select({ id: tenantIncidents.id })
    .from(tenantIncidents)
    .where(eq(tenantIncidents.id, incidentId))
    .limit(1)

  if (!incident) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  // Delete mute if exists (idempotent - ok if not found)
  await db
    .delete(tenantIncidentUserMutes)
    .where(
      and(
        eq(tenantIncidentUserMutes.incidentId, incidentId),
        eq(tenantIncidentUserMutes.userId, userId)
      )
    )

  return { success: true, muted: false }
})

