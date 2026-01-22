/**
 * POST /api/admin/incidents/:incidentId/mute
 *
 * Mutes an incident for the current scope (org or tenant).
 * The incident will no longer appear in the feed for that scope.
 */

import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { tenantIncidents, tenantIncidentMutes, organizations } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { ensureAuthState } from '../../../../utils/session'
import { requirePermission, requireTenantPermission } from '../../../../utils/rbac'
import { logOrganizationAction, logTenantAction } from '../../../../utils/audit'
import { createId } from '@paralleldrive/cuid2'

const muteSchema = z.object({
  targetType: z.enum(['organization', 'tenant']),
  muteUntil: z.string().datetime().optional().nullable()
})

export default defineEventHandler(async (event) => {
  const incidentId = getRouterParam(event, 'incidentId')
  if (!incidentId) {
    throw createError({ statusCode: 400, message: 'Missing incident ID' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const payload = muteSchema.parse(await readBody(event))
  const db = getDb()

  // Verify incident exists
  const [incident] = await db
    .select()
    .from(tenantIncidents)
    .where(eq(tenantIncidents.id, incidentId))
    .limit(1)

  if (!incident) {
    throw createError({ statusCode: 404, message: 'Incident not found' })
  }

  let targetTenantId: string | null = null
  let organizationId: string | null = null

  if (payload.targetType === 'organization') {
    // Require org:manage permission for org mute
    const { orgId } = await requirePermission(event, 'org:manage')
    organizationId = orgId

    // Verify the org exists and get its tenant
    const [org] = await db
      .select({ tenantId: organizations.tenantId })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!org) {
      throw createError({ statusCode: 404, message: 'Organization not found' })
    }
  } else if (payload.targetType === 'tenant') {
    // Use current tenant context
    if (!auth.currentTenantId) {
      throw createError({ statusCode: 400, message: 'No tenant context for tenant mute' })
    }
    await requireTenantPermission(event, 'tenants:manage', auth.currentTenantId)
    targetTenantId = auth.currentTenantId
  }

  const now = new Date()

  // Check if mute already exists
  const existingMuteCondition =
    payload.targetType === 'organization'
      ? and(
          eq(tenantIncidentMutes.incidentId, incidentId),
          eq(tenantIncidentMutes.targetType, 'organization'),
          eq(tenantIncidentMutes.organizationId, organizationId!)
        )
      : and(
          eq(tenantIncidentMutes.incidentId, incidentId),
          eq(tenantIncidentMutes.targetType, 'tenant'),
          eq(tenantIncidentMutes.targetTenantId, targetTenantId!)
        )

  const [existingMute] = await db
    .select()
    .from(tenantIncidentMutes)
    .where(existingMuteCondition)
    .limit(1)

  if (existingMute) {
    // Update existing mute
    await db
      .update(tenantIncidentMutes)
      .set({
        muteUntil: payload.muteUntil ? new Date(payload.muteUntil) : null,
        mutedAt: now,
        mutedByUserId: auth.user.id
      })
      .where(eq(tenantIncidentMutes.id, existingMute.id))
  } else {
    // Create new mute
    await db.insert(tenantIncidentMutes).values({
      id: createId(),
      incidentId,
      targetType: payload.targetType,
      targetTenantId,
      organizationId,
      mutedByUserId: auth.user.id,
      mutedAt: now,
      muteUntil: payload.muteUntil ? new Date(payload.muteUntil) : null
    })
  }

  // Log the action
  if (payload.targetType === 'organization' && organizationId) {
    await logOrganizationAction(event, 'INCIDENT_MUTED', {
      incidentId,
      incidentTitle: incident.title,
      targetType: 'organization',
      muteUntil: payload.muteUntil
    }, organizationId)
  } else if (targetTenantId) {
    await logTenantAction(
      event,
      'INCIDENT_MUTED',
      {
        incidentId,
        incidentTitle: incident.title,
        targetType: 'tenant',
        muteUntil: payload.muteUntil
      },
      targetTenantId
    )
  }

  return { success: true, muted: true }
})

