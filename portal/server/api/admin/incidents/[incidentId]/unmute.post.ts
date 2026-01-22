/**
 * POST /api/admin/incidents/:incidentId/unmute
 *
 * Removes a mute for an incident in the current scope (org or tenant).
 */

import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { tenantIncidents, tenantIncidentMutes, organizations } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { ensureAuthState } from '../../../../utils/session'
import { requirePermission, requireTenantPermission } from '../../../../utils/rbac'
import { logOrganizationAction, logTenantAction } from '../../../../utils/audit'

const unmuteSchema = z.object({
  targetType: z.enum(['organization', 'tenant'])
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

  const payload = unmuteSchema.parse(await readBody(event))
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

  let deleteCondition

  if (payload.targetType === 'organization') {
    const { orgId } = await requirePermission(event, 'org:manage')

    deleteCondition = and(
      eq(tenantIncidentMutes.incidentId, incidentId),
      eq(tenantIncidentMutes.targetType, 'organization'),
      eq(tenantIncidentMutes.organizationId, orgId)
    )

    // Delete the mute
    await db.delete(tenantIncidentMutes).where(deleteCondition)

    await logOrganizationAction(event, 'INCIDENT_UNMUTED', {
      incidentId,
      incidentTitle: incident.title,
      targetType: 'organization'
    }, orgId)
  } else if (payload.targetType === 'tenant') {
    if (!auth.currentTenantId) {
      throw createError({ statusCode: 400, message: 'No tenant context for tenant unmute' })
    }
    await requireTenantPermission(event, 'tenants:manage', auth.currentTenantId)

    deleteCondition = and(
      eq(tenantIncidentMutes.incidentId, incidentId),
      eq(tenantIncidentMutes.targetType, 'tenant'),
      eq(tenantIncidentMutes.targetTenantId, auth.currentTenantId)
    )

    // Delete the mute
    await db.delete(tenantIncidentMutes).where(deleteCondition)

    await logTenantAction(
      event,
      'INCIDENT_UNMUTED',
      {
        incidentId,
        incidentTitle: incident.title,
        targetType: 'tenant'
      },
      auth.currentTenantId
    )
  }

  return { success: true, muted: false }
})

