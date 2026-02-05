import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import {
  tenantMemberships,
  mspRoles,
  tenantMemberMspRoles,
  tenants
} from '~~/server/database/schema'
import { ensureAuthState } from '~~/server/utils/session'
import { logTenantAction } from '~~/server/utils/audit'

const assignMspRolesSchema = z.object({
  roleIds: z.array(z.string()).default([])
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const memberId = getRouterParam(event, 'memberId')

  if (!tenantId || !memberId) {
    throw createError({ statusCode: 400, message: 'Tenant ID och Member ID krävs.' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  await requireTenantPermission(event, 'tenants:manage-members', tenantId)

  const db = getDb()

  // Verify tenant exists
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  // Verify membership exists and belongs to tenant
  const [membership] = await db
    .select()
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.id, memberId), eq(tenantMemberships.tenantId, tenantId)))
    .limit(1)

  if (!membership) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  const payload = assignMspRolesSchema.parse(await readBody(event))

  // Validate all roleIds belong to this tenant
  if (payload.roleIds.length > 0) {
    const roles = await db
      .select()
      .from(mspRoles)
      .where(and(eq(mspRoles.tenantId, tenantId), inArray(mspRoles.id, payload.roleIds)))

    const foundRoleIds = new Set(roles.map((r) => r.id))
    const invalidRoleIds = payload.roleIds.filter((id) => !foundRoleIds.has(id))

    if (invalidRoleIds.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Följande roller tillhör inte denna tenant: ${invalidRoleIds.join(', ')}`
      })
    }

    // Check if all requested roleIds exist
    if (roles.length !== payload.roleIds.length) {
      throw createError({
        statusCode: 404,
        message: 'En eller flera roller kunde inte hittas.'
      })
    }
  }

  // Get current assignments
  const currentAssignments = await db
    .select()
    .from(tenantMemberMspRoles)
    .where(eq(tenantMemberMspRoles.tenantMembershipId, memberId))

  const currentRoleIds = new Set(currentAssignments.map((a) => a.roleId))
  const requestedRoleIds = new Set(payload.roleIds)

  // Calculate diff
  const toAdd = payload.roleIds.filter((id) => !currentRoleIds.has(id))
  const toRemove = Array.from(currentRoleIds).filter((id) => !requestedRoleIds.has(id))

  // Atomic update in transaction
  await db.transaction(async (tx) => {
    // Remove old assignments
    if (toRemove.length > 0) {
      const toRemoveAssignments = currentAssignments
        .filter((a) => toRemove.includes(a.roleId))
        .map((a) => a.roleId)

      await tx
        .delete(tenantMemberMspRoles)
        .where(
          and(
            eq(tenantMemberMspRoles.tenantMembershipId, memberId),
            inArray(tenantMemberMspRoles.roleId, toRemoveAssignments)
          )
        )
    }

    // Add new assignments
    if (toAdd.length > 0) {
      await tx.insert(tenantMemberMspRoles).values(
        toAdd.map((roleId: string) => ({
          tenantMembershipId: memberId,
          roleId
        }))
      )
    }
  })

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_roles_assigned',
      tenantName: tenant.name,
      membershipId: memberId,
      beforeRoleIds: Array.from(currentRoleIds),
      afterRoleIds: payload.roleIds,
      addedRoleIds: toAdd,
      removedRoleIds: toRemove
    },
    tenantId
  )

  // Return updated assignments
  const updatedAssignments = await db
    .select({
      roleId: tenantMemberMspRoles.roleId,
      roleKey: mspRoles.key,
      roleName: mspRoles.name
    })
    .from(tenantMemberMspRoles)
    .innerJoin(mspRoles, eq(mspRoles.id, tenantMemberMspRoles.roleId))
    .where(eq(tenantMemberMspRoles.tenantMembershipId, memberId))

  return {
    roleIds: updatedAssignments.map((a) => ({
      id: a.roleId,
      key: a.roleKey,
      name: a.roleName
    }))
  }
})
