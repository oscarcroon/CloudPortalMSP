import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import type { TenantRole } from '~/constants/rbac'
import { getDb } from '../../../../../../utils/db'
import { requireTenantPermission } from '../../../../../../utils/rbac'
import {
  tenantMemberships,
  tenantMemberRoles,
  tenants,
  users
} from '../../../../../../database/schema'
import { fetchTenantMemberPayload } from '../helpers'
import { logTenantAction } from '../../../../../../utils/audit'

const includeChildrenSchema = z.object({
  includeChildren: z.boolean()
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

  const permissionCheck = await requireTenantPermission(event, 'tenants:manage-members', tenantId)
  const auth = permissionCheck.auth
  const actorRole = permissionCheck.role
  const isSuperAdmin = auth.user.isSuperAdmin

  const { includeChildren } = includeChildrenSchema.parse(await readBody(event))
  const db = getDb()

  const [membership] = await db
    .select({
      id: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      userId: tenantMemberships.userId,
      role: tenantMemberships.role,
      includeChildren: tenantMemberships.includeChildren,
      userEmail: users.email,
      userFullName: users.fullName,
      tenantName: tenants.name,
      tenantType: tenants.type
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(eq(tenantMemberships.id, memberId))
    .limit(1)

  if (!membership || membership.tenantId !== tenantId) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  if (membership.includeChildren === includeChildren) {
    return fetchTenantMemberPayload(db, membership.id)
  }

  const memberRole = membership.role as TenantRole
  const roleRows = await db
    .select({ roleKey: tenantMemberRoles.roleKey })
    .from(tenantMemberRoles)
    .where(eq(tenantMemberRoles.membershipId, membership.id))

  const hasMspRole =
    memberRole.startsWith('msp-') ||
    roleRows.some((row) => typeof row.roleKey === 'string' && row.roleKey.startsWith('msp-'))

  if (includeChildren) {
    if (membership.tenantType === 'provider') {
      if (!hasMspRole) {
        throw createError({
          statusCode: 400,
          message: 'Endast MSP-roller kan få åtkomst till alla organisationer för en leverantör.'
        })
      }
      if (!isSuperAdmin && actorRole !== 'admin') {
        throw createError({
          statusCode: 403,
          message: 'Endast leverantörens admin eller superadmin kan ge åtkomst till alla organisationer.'
        })
      }
    } else if (membership.tenantType === 'distributor') {
      if (memberRole !== 'admin' && !hasMspRole) {
        throw createError({
          statusCode: 400,
          message: 'Endast admin eller MSP-roller kan få åtkomst till alla leverantörer under en distributör.'
        })
      }
      if (!isSuperAdmin) {
        throw createError({
          statusCode: 403,
          message: 'Endast superadmins kan ge åtkomst till alla leverantörer under en distributör.'
        })
      }
    } else {
      throw createError({
        statusCode: 400,
        message: 'Include children stöds endast för distributörer och leverantörer.'
      })
    }
  }

  await db
    .update(tenantMemberships)
    .set({
      includeChildren: includeChildren ? 1 : 0,
      updatedAt: new Date()
    })
    .where(eq(tenantMemberships.id, membership.id))

  const payload = await fetchTenantMemberPayload(db, membership.id)

  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'include_children_updated',
      tenantName: membership.tenantName,
      targetUserId: membership.userId,
      targetUserEmail: membership.userEmail,
      includeChildrenBefore: membership.includeChildren,
      includeChildrenAfter: includeChildren
    },
    tenantId
  )

  return payload
})

