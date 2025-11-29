import { and, eq, ne, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { tenantRoles } from '~/constants/rbac'
import { getDb } from '../../../../../../utils/db'
import { requireTenantPermission } from '../../../../../../utils/rbac'
import { tenantMemberships, tenants, users } from '../../../../../../database/schema'
import { fetchTenantMemberPayload } from '../helpers'
import { logTenantAction } from '../../../../../../utils/audit'
import type { OrganizationMemberStatus } from '~/types/admin'

const roleSchema = z.object({
  role: z.enum(tenantRoles)
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
  const permissionCheck = await requireTenantPermission(event, 'tenants:manage-members', tenantId)
  const auth = permissionCheck.auth
  const actorUserId = auth.user.id
  
  const { role: newRole } = roleSchema.parse(await readBody(event))
  const db = getDb()

  // Get tenant to verify it exists
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      type: tenants.type
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  // Get membership with user info
  const [membership] = await db
    .select({
      id: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      userId: tenantMemberships.userId,
      role: tenantMemberships.role,
      status: tenantMemberships.status,
      userEmail: users.email,
      userFullName: users.fullName
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(eq(tenantMemberships.id, memberId))
    .limit(1)

  if (!membership || membership.tenantId !== tenantId) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  // No-op handling
  if (membership.role === newRole) {
    return fetchTenantMemberPayload(db, membership.id)
  }

  const oldRole = membership.role

  // Security validation - ensure at least one active admin remains
  if (membership.role === 'admin' && newRole !== 'admin') {
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

    const otherActiveAdminsCount = remainingAdmins?.count ?? 0

    if (otherActiveAdminsCount === 0) {
      // Self-demotion protection
      if (actorUserId === membership.userId) {
        throw createError({
          statusCode: 400,
          message: 'Du kan inte ta bort dina egna admin-rättigheter när du är enda aktiva admin.'
        })
      }

      throw createError({
        statusCode: 400,
        message: 'Det måste finnas minst en aktiv admin kvar för denna tenant.'
      })
    }
  }

  // Update role
  await db
    .update(tenantMemberships)
    .set({ 
      role: newRole,
      updatedAt: new Date()
    })
    .where(eq(tenantMemberships.id, membership.id))

  const payload = await fetchTenantMemberPayload(db, membership.id)

  // SECURITY: Log role change for audit trail
  await logTenantAction(
    event,
    'ROLE_CHANGED',
    {
      targetUserId: membership.userId,
      targetUserEmail: membership.userEmail,
      targetUserFullName: membership.userFullName,
      tenantName: tenant.name,
      oldRole,
      newRole
    },
    tenantId
  )

  return payload
})

