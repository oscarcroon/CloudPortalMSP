/**
 * POST /api/admin/tenants/:tenantId/incidents/:incidentId/unarchive
 *
 * Restores an archived incident back to resolved status.
 */

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { tenantIncidents, tenants } from '~~/server/database/schema'
import { logTenantAction } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const incidentId = getRouterParam(event, 'incidentId')
  if (!tenantId || !incidentId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID or incident ID' })
  }

  const { auth } = await requireTenantPermission(event, 'tenants:manage', tenantId)

  const db = getDb()

  // Verify tenant is distributor or provider
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))
  if (!tenant || !['distributor', 'provider'].includes(tenant.type)) {
    throw createError({ statusCode: 403, message: 'Only distributors and providers can unarchive incidents.' })
  }

  // Verify incident exists and belongs to this tenant
  const [existingIncident] = await db.select().from(tenantIncidents).where(eq(tenantIncidents.id, incidentId))
  if (!existingIncident || existingIncident.sourceTenantId !== tenantId) {
    throw createError({ statusCode: 404, message: 'Incident not found or not owned by this tenant.' })
  }

  if (existingIncident.status !== 'archived') {
    return { status: 'not_archived' }
  }

  await db.update(tenantIncidents).set({
    status: 'resolved',
    updatedByUserId: auth.user.id,
    updatedAt: new Date()
  }).where(eq(tenantIncidents.id, incidentId))

  await logTenantAction(event, 'INCIDENT_UNARCHIVED', {
    incidentId,
    title: existingIncident.title
  }, tenantId)

  return { status: 'ok' }
})

