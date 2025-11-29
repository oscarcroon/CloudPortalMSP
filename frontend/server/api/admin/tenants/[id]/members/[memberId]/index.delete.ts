import { and, eq, ne, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDb } from '../../../../../../utils/db'
import { requireTenantPermission } from '../../../../../../utils/rbac'
import { tenantMemberships } from '../../../../../../database/schema'
import { fetchTenantMemberPayload } from '../helpers'
import { logUserAction } from '../../../../../../utils/audit'
import type { OrganizationMemberStatus } from '~/types/admin'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const memberId = getRouterParam(event, 'memberId')
  
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }
  
  if (!memberId) {
    throw createError({ statusCode: 400, message: 'Medlems-ID saknas' })
  }

  // Check permissions - user must have admin role on the tenant
  await requireTenantPermission(event, 'tenants:manage-members', tenantId)
  
  const db = getDb()

  const [membership] = await db
    .select({
      id: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role,
      status: tenantMemberships.status
    })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.id, memberId))
    .limit(1)

  if (!membership || membership.tenantId !== tenantId) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  // If removing an admin, ensure at least one admin remains
  if (membership.role === 'admin' && membership.status === 'active') {
    const [remainingAdmins] = await db
      .select({
        count: sql<number>`count(${tenantMemberships.id})`
      })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.role, 'admin'),
          eq(tenantMemberships.status, 'active' as OrganizationMemberStatus),
          ne(tenantMemberships.id, memberId)
        )
      )
      .limit(1)

    const count = remainingAdmins?.count ?? 0
    if (count < 1) {
      throw createError({
        statusCode: 400,
        message: 'Leverantören måste ha minst en aktiv admin.'
      })
    }
  }

  const payload = await fetchTenantMemberPayload(db, membership.id)

  await db.delete(tenantMemberships).where(eq(tenantMemberships.id, membership.id))

  // Log audit event
  await logUserAction(event, 'USER_REMOVED', {
    targetUserId: payload.member.userId,
    tenantId: tenantId,
    role: membership.role
  }, payload.member.userId)

  return payload
})

