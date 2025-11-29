import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, inArray } from 'drizzle-orm'
import {
  tenantInvitations,
  tenantMemberships,
  users,
  tenants
} from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireTenantPermission } from '../../../../utils/rbac'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }

  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  // Check permissions
  await requireTenantPermission(event, 'tenants:read', tenantId)

  // Get tenant
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  // Get members
  const memberRows = await db
    .select({
      membershipId: tenantMemberships.id,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      role: tenantMemberships.role,
      status: tenantMemberships.status,
      includeChildren: tenantMemberships.includeChildren,
      addedAt: tenantMemberships.createdAt
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(eq(tenantMemberships.tenantId, tenantId))

  // Get tenant invitations
  const inviteRows = isSqlite
    ? await db
        .select({
          id: tenantInvitations.id,
          email: tenantInvitations.email,
          role: tenantInvitations.role,
          status: tenantInvitations.status,
          invitedAt: tenantInvitations.createdAt,
          expiresAt: tenantInvitations.expiresAt,
          invitedById: tenantInvitations.invitedByUserId,
          invitedByEmail: users.email,
          invitedByName: users.fullName,
          organizationData: tenantInvitations.organizationData
        })
        .from(tenantInvitations)
        .leftJoin(users, eq(users.id, tenantInvitations.invitedByUserId))
        .where(eq(tenantInvitations.tenantId, tenantId))
        .all()
    : await db
        .select({
          id: tenantInvitations.id,
          email: tenantInvitations.email,
          role: tenantInvitations.role,
          status: tenantInvitations.status,
          invitedAt: tenantInvitations.createdAt,
          expiresAt: tenantInvitations.expiresAt,
          invitedById: tenantInvitations.invitedByUserId,
          invitedByEmail: users.email,
          invitedByName: users.fullName,
          organizationData: tenantInvitations.organizationData
        })
        .from(tenantInvitations)
        .leftJoin(users, eq(users.id, tenantInvitations.invitedByUserId))
        .where(eq(tenantInvitations.tenantId, tenantId))

  // Check for expired invitations
  const now = new Date()
  const expiredInviteIds: string[] = []

  const invitations = inviteRows.map((row) => {
    const expiresAtDate = row.expiresAt ? new Date(row.expiresAt) : null
    const isExpired =
      row.status === 'pending' &&
      expiresAtDate &&
      !Number.isNaN(expiresAtDate.getTime()) &&
      expiresAtDate.getTime() < now.getTime()
    if (isExpired) {
      expiredInviteIds.push(row.id)
    }
    const status = isExpired ? 'expired' : (row.status as 'pending' | 'accepted' | 'cancelled' | 'expired')
    
    // Parse organization data if present
    let organizationData = null
    let willCreateOrganization = false
    let organizationName: string | undefined = undefined
    
    if (row.organizationData) {
      try {
        organizationData = JSON.parse(row.organizationData)
        willCreateOrganization = true
        organizationName = organizationData?.name
      } catch {
        // Invalid JSON, ignore
      }
    }

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status,
      invitedAt: row.invitedAt ? new Date(row.invitedAt).toISOString() : null,
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      willCreateOrganization,
      organizationName,
      invitedBy:
        row.invitedById && row.invitedByEmail
          ? {
              id: row.invitedById,
              email: row.invitedByEmail,
              fullName: row.invitedByName
            }
          : null
    }
  })

  // Update expired invitations
  if (expiredInviteIds.length > 0) {
    await db
      .update(tenantInvitations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(inArray(tenantInvitations.id, expiredInviteIds))
  }

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      type: tenant.type,
      status: tenant.status
    },
    members: memberRows.map((row) => ({
      membershipId: row.membershipId,
      userId: row.userId,
      email: row.email,
      fullName: row.fullName,
      role: row.role,
      status: row.status,
      includeChildren: Boolean(row.includeChildren),
      addedAt: row.addedAt ? new Date(row.addedAt).toISOString() : null
    })),
    invites: invitations
  }
})
