/**
 * GET /api/admin/tenants/:tenantId/incidents
 *
 * Lists incidents for a tenant. Only the source tenant's incidents are returned.
 * Query params:
 * - filter: 'active' | 'all' (default: 'active')
 * - includeDeleted: 'true' | 'false' (default: 'false', superadmin only)
 */

import { eq, and, isNull, desc, or } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, getQuery } from 'h3'
import { tenantIncidents, tenants, users } from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { requireTenantPermission } from '../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../utils/session'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  await requireTenantPermission(event, 'tenants:read', tenantId)
  const auth = await ensureAuthState(event)

  const query = getQuery(event)
  const filter = (query.filter as string) || 'active'
  const includeDeleted = query.includeDeleted === 'true' && auth?.user.isSuperAdmin

  const db = getDb()

  // Verify tenant exists and is distributor or provider
  const [tenant] = await db
    .select({ type: tenants.type })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  // Build query conditions
  const conditions = [eq(tenantIncidents.sourceTenantId, tenantId)]

  if (!includeDeleted) {
    conditions.push(isNull(tenantIncidents.deletedAt))
  }

  if (filter === 'active') {
    conditions.push(eq(tenantIncidents.status, 'active'))
  }

  const incidents = await db
    .select({
      id: tenantIncidents.id,
      title: tenantIncidents.title,
      bodyMarkdown: tenantIncidents.bodyMarkdown,
      severity: tenantIncidents.severity,
      status: tenantIncidents.status,
      startsAt: tenantIncidents.startsAt,
      endsAt: tenantIncidents.endsAt,
      resolvedAt: tenantIncidents.resolvedAt,
      createdAt: tenantIncidents.createdAt,
      updatedAt: tenantIncidents.updatedAt,
      deletedAt: tenantIncidents.deletedAt,
      createdByUserId: tenantIncidents.createdByUserId,
      createdByEmail: users.email,
      createdByName: users.fullName
    })
    .from(tenantIncidents)
    .leftJoin(users, eq(users.id, tenantIncidents.createdByUserId))
    .where(and(...conditions))
    .orderBy(desc(tenantIncidents.createdAt))

  return {
    incidents: incidents.map((i) => ({
      ...i,
      createdBy: i.createdByUserId
        ? { id: i.createdByUserId, email: i.createdByEmail, fullName: i.createdByName }
        : null
    })),
    tenantType: tenant.type
  }
})

