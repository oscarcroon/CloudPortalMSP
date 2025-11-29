import { and, eq, ne, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { getDb } from '../../../../../../utils/db'
import { requireTenantPermission } from '../../../../../../utils/rbac'
import { tenantMemberships } from '../../../../../../database/schema'
import { fetchTenantMemberPayload } from '../helpers'
import { logUserAction } from '../../../../../../utils/audit'
import type { OrganizationMemberStatus } from '~/types/admin'

const statusSchema = z.object({
  status: z.enum(['active', 'suspended'])
})

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
  
  const { status } = statusSchema.parse(await readBody(event))
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

  if (!['active', 'suspended'].includes(membership.status as string)) {
    throw createError({
      statusCode: 400,
      message: 'Status kan endast ändras för aktiva eller avstängda medlemmar.'
    })
  }

  if (membership.status === status) {
    return fetchTenantMemberPayload(db, membership.id)
  }

  // If suspending an admin, ensure at least one admin remains
  if (membership.role === 'admin' && status === 'suspended' && membership.status === 'active') {
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

  await db
    .update(tenantMemberships)
    .set({ 
      status: status as OrganizationMemberStatus,
      updatedAt: new Date()
    })
    .where(eq(tenantMemberships.id, membership.id))

  const payload = await fetchTenantMemberPayload(db, membership.id)

  // Log audit event
  await logUserAction(event, 'USER_UPDATED', {
    targetUserId: payload.member.userId,
    tenantId: tenantId,
    field: 'status',
    oldValue: membership.status,
    newValue: status
  }, payload.member.userId)

  return payload
})

