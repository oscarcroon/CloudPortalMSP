import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, and, isNull, or, gt } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import {
  tenantMemberships,
  organizations,
  mspOrgDelegations
} from '~~/server/database/schema'
import { fetchTenantMemberPayload } from '../helpers'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const memberId = getRouterParam(event, 'memberId')

  if (!tenantId || !memberId) {
    throw createError({ statusCode: 400, message: 'Tenant ID och member ID krävs.' })
  }

  // Use read permission instead of manage-members for fetching scope
  await requireTenantPermission(event, 'tenants:read', tenantId)

  const db = getDb()
  const [membership] = await db
    .select({
      id: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      userId: tenantMemberships.userId
    })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.id, memberId))
    .limit(1)

  if (!membership || membership.tenantId !== tenantId) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  // Get all active LIST-scope delegations for this membership
  const now = new Date()
  const delegations = await db
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
          gt(mspOrgDelegations.expiresAt, now)
        )
      )
    )

  return {
    orgIds: delegations.map((d) => ({
      id: d.orgId,
      name: d.orgName,
      slug: d.orgSlug,
      expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
      note: d.note,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null
    }))
  }
})
