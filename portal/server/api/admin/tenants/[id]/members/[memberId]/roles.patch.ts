import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { inArray, eq } from 'drizzle-orm'
import type { TenantRole } from '~/constants/rbac'
import { tenantMemberRoles, tenantMemberships } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { fetchTenantMemberPayload } from '../helpers'

const rolesSchema = z.object({
  mspRoles: z.array(z.string()).default([])
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const memberId = getRouterParam(event, 'memberId')

  if (!tenantId || !memberId) {
    throw createError({ statusCode: 400, message: 'Tenant ID och member ID krävs.' })
  }

  await requireTenantPermission(event, 'tenants:manage-members', tenantId)

  const payload = rolesSchema.parse(await readBody(event))
  const db = getDb()

  const [membership] = await db
    .select({
      id: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role
    })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.id, memberId))
    .limit(1)

  if (!membership || membership.tenantId !== tenantId) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  const normalizedRoles = Array.from(
    new Set(
      payload.mspRoles
        .filter((role): role is TenantRole => typeof role === 'string' && role.startsWith('msp-'))
        .map((role) => role as TenantRole)
    )
  )

  const existingPrimaryIsMsp = membership.role.startsWith('msp-')
  const includeChildrenShouldRemain = Boolean(normalizedRoles.length || existingPrimaryIsMsp)

  await db.transaction(async (tx) => {
    await tx.delete(tenantMemberRoles).where(eq(tenantMemberRoles.membershipId, memberId))

    if (normalizedRoles.length) {
      await tx.insert(tenantMemberRoles).values(
        normalizedRoles.map((roleKey) => ({
          membershipId: memberId,
          roleKey
        }))
      )
    }

    if (!includeChildrenShouldRemain) {
      await tx
        .update(tenantMemberships)
        .set({ includeChildren: false, updatedAt: new Date() })
        .where(eq(tenantMemberships.id, memberId))
    }
  })

  return fetchTenantMemberPayload(db, memberId)
})
