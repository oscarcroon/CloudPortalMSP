import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { eq, and, isNull, or, gt, inArray } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import {
  tenantMemberships,
  organizations,
  mspOrgDelegations,
  users
} from '~~/server/database/schema'
import { createId } from '@paralleldrive/cuid2'
import { ensureAuthState } from '~~/server/utils/session'
import { logTenantAction } from '~~/server/utils/audit'

const mspOrgScopeSchema = z.object({
  orgIds: z.array(z.string()).default([]),
  expiresAt: z.number().nullable().optional(),
  note: z.string().nullable().optional()
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const memberId = getRouterParam(event, 'memberId')

  if (!tenantId || !memberId) {
    throw createError({ statusCode: 400, message: 'Tenant ID och member ID krävs.' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  await requireTenantPermission(event, 'tenants:manage-members', tenantId)

  const payload = mspOrgScopeSchema.parse(await readBody(event))
  const db = getDb()

  // Get membership
  const [membership] = await db
    .select({
      id: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      userId: tenantMemberships.userId,
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

  // Validate that all orgIds belong to this tenant
  if (payload.orgIds.length > 0) {
    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        tenantId: organizations.tenantId
      })
      .from(organizations)
      .where(inArray(organizations.id, payload.orgIds))

    const invalidOrgs = orgs.filter((org) => org.tenantId !== tenantId)
    if (invalidOrgs.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Följande organisationer tillhör inte denna leverantör: ${invalidOrgs.map((o) => o.name).join(', ')}`
      })
    }

    // Check if all requested orgIds exist
    const foundOrgIds = new Set(orgs.map((o) => o.id))
    const missingOrgIds = payload.orgIds.filter((id) => !foundOrgIds.has(id))
    if (missingOrgIds.length > 0) {
      throw createError({
        statusCode: 404,
        message: `Följande organisationer kunde inte hittas: ${missingOrgIds.join(', ')}`
      })
    }
  }

  // Get current active LIST-scope delegations
  const now = new Date()
  const currentDelegations = await db
    .select({
      id: mspOrgDelegations.id,
      orgId: mspOrgDelegations.orgId
    })
    .from(mspOrgDelegations)
    .where(
      and(
        eq(mspOrgDelegations.subjectType, 'user'),
        eq(mspOrgDelegations.subjectId, membership.userId),
        eq(mspOrgDelegations.source, 'msp_scope'),
        eq(mspOrgDelegations.supplierTenantId, tenantId),
        isNull(mspOrgDelegations.revokedAt),
        or(
          isNull(mspOrgDelegations.expiresAt),
          gt(mspOrgDelegations.expiresAt, now)
        )
      )
    )

  const currentOrgIds = new Set(currentDelegations.map((d) => d.orgId))
  const requestedOrgIds = new Set(payload.orgIds)

  // Calculate diff
  const toAdd = payload.orgIds.filter((id) => !currentOrgIds.has(id))
  const toRemove = Array.from(currentOrgIds).filter((id) => !requestedOrgIds.has(id))

  // Transaction: revoke removed, add new
  await db.transaction(async (tx) => {
    // Revoke removed delegations
    if (toRemove.length > 0) {
      const toRevokeIds = currentDelegations
        .filter((d) => toRemove.includes(d.orgId))
        .map((d) => d.id)

      await tx
        .update(mspOrgDelegations)
        .set({
          revokedAt: new Date(),
          revokedBy: auth.user.id,
          updatedAt: new Date()
        })
        .where(inArray(mspOrgDelegations.id, toRevokeIds))
    }

    // Add new delegations
    if (toAdd.length > 0) {
      const newDelegations = toAdd.map((orgId) => ({
        id: createId(),
        orgId,
        subjectType: 'user' as const,
        subjectId: membership.userId,
        source: 'msp_scope' as const,
        supplierTenantId: tenantId,
        createdBy: auth.user.id,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        note: payload.note || null,
        revokedAt: null,
        revokedBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      await tx.insert(mspOrgDelegations).values(newDelegations)
    }
  })

  // Audit log
  await logTenantAction(
    event,
    'TENANT_UPDATED',
    {
      action: 'msp_org_scope_updated',
      tenantName: tenantId,
      targetUserId: membership.userId,
      targetUserEmail: membership.userEmail,
      beforeOrgIds: Array.from(currentOrgIds),
      afterOrgIds: payload.orgIds,
      addedOrgIds: toAdd,
      removedOrgIds: toRemove,
      expiresAt: payload.expiresAt,
      note: payload.note
    },
    tenantId
  )

  // Return updated scope
  const updatedDelegations = await db
    .select({
      id: mspOrgDelegations.id,
      orgId: mspOrgDelegations.orgId,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      expiresAt: mspOrgDelegations.expiresAt,
      note: mspOrgDelegations.note,
      createdAt: mspOrgDelegations.createdAt
    })
    .from(mspOrgDelegations)
    .innerJoin(organizations, eq(organizations.id, mspOrgDelegations.orgId))
    .where(
      and(
        eq(mspOrgDelegations.subjectType, 'user'),
        eq(mspOrgDelegations.subjectId, membership.userId),
        eq(mspOrgDelegations.source, 'msp_scope'),
        eq(mspOrgDelegations.supplierTenantId, tenantId),
        isNull(mspOrgDelegations.revokedAt),
        or(
          isNull(mspOrgDelegations.expiresAt),
          gt(mspOrgDelegations.expiresAt, new Date())
        )
      )
    )

  return {
    orgIds: updatedDelegations.map((d) => ({
      id: d.orgId,
      name: d.orgName,
      slug: d.orgSlug,
      expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
      note: d.note,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null
    }))
  }
})
