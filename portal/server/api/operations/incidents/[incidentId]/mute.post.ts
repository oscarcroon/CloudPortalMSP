/**
 * POST /api/operations/incidents/:incidentId/mute
 *
 * Creates a personal mute for the current user on an incident.
 * This hides the incident only for the current user.
 */

import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { tenantIncidents, tenantIncidentUserMutes } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { ensureAuthState } from '../../../../utils/session'
import { createId } from '@paralleldrive/cuid2'

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

  // Check if mute already exists (idempotent upsert)
  const [existingMute] = await db
    .select({ id: tenantIncidentUserMutes.id })
    .from(tenantIncidentUserMutes)
    .where(
      and(
        eq(tenantIncidentUserMutes.incidentId, incidentId),
        eq(tenantIncidentUserMutes.userId, userId)
      )
    )
    .limit(1)

  if (existingMute) {
    // Already muted - update timestamp
    await db
      .update(tenantIncidentUserMutes)
      .set({ mutedAt: new Date() })
      .where(eq(tenantIncidentUserMutes.id, existingMute.id))
  } else {
    // Create new mute
    await db.insert(tenantIncidentUserMutes).values({
      id: createId(),
      incidentId,
      userId,
      mutedAt: new Date()
    })
  }

  return { success: true, muted: true }
})

