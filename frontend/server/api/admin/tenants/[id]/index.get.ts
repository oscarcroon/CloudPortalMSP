import { eq, sql, and, inArray, lt } from 'drizzle-orm'
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { tenants, tenantMemberships, tenantInvitations, users, organizations, emailProviderProfiles, distributorProviders } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { ensureAuthState } from '../../../../utils/session'
import { canAccessTenant } from '../../../../utils/rbac'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  // Check access
  if (!auth.user.isSuperAdmin) {
    let hasAccess = false
    if (auth.tenantRoles[tenantId]) {
      hasAccess = true
    } else {
      for (const userTenantId of Object.keys(auth.tenantRoles)) {
        if (await canAccessTenant(auth, userTenantId, tenantId)) {
          hasAccess = true
          break
        }
      }
    }

    if (!hasAccess) {
      throw createError({ statusCode: 403, message: 'Access denied to tenant' })
    }
  }

  // Get members
  const members = await db
    .select({
      id: tenantMemberships.id,
      userId: tenantMemberships.userId,
      role: tenantMemberships.role,
      status: tenantMemberships.status,
      user: {
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        status: users.status
      }
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(eq(tenantMemberships.tenantId, tenantId))

  // Get related tenants based on type
  let childTenants: any[] = []
  let linkedTenants: any[] = []
  
  if (tenant.type === 'distributor') {
    // For distributors, get linked providers via junction table
    linkedTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        type: tenants.type,
        parentTenantId: tenants.parentTenantId,
        status: tenants.status,
        createdAt: tenants.createdAt,
        hasEmailOverride: sql<boolean>`(
          select exists(
            select 1
            from ${emailProviderProfiles}
            where ${emailProviderProfiles.tenantId} = ${tenants.id}
            and ${emailProviderProfiles.isActive} = 1
            and ${emailProviderProfiles.targetType} in ('provider', 'distributor')
          )
        )`
      })
      .from(distributorProviders)
      .innerJoin(tenants, eq(tenants.id, distributorProviders.providerId))
      .where(eq(distributorProviders.distributorId, tenantId))
  } else if (tenant.type === 'provider') {
    // For providers, get linked distributors via junction table
    linkedTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        type: tenants.type,
        parentTenantId: tenants.parentTenantId,
        status: tenants.status,
        createdAt: tenants.createdAt,
        hasEmailOverride: sql<boolean>`(
          select exists(
            select 1
            from ${emailProviderProfiles}
            where ${emailProviderProfiles.tenantId} = ${tenants.id}
            and ${emailProviderProfiles.isActive} = 1
            and ${emailProviderProfiles.targetType} in ('provider', 'distributor')
          )
        )`
      })
      .from(distributorProviders)
      .innerJoin(tenants, eq(tenants.id, distributorProviders.distributorId))
      .where(eq(distributorProviders.providerId, tenantId))
    
    // Legacy: Also get child tenants via parentTenantId for backward compatibility
    const legacyChildren = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        type: tenants.type,
        parentTenantId: tenants.parentTenantId,
        status: tenants.status,
        createdAt: tenants.createdAt,
        hasEmailOverride: sql<boolean>`(
          select exists(
            select 1
            from ${emailProviderProfiles}
            where ${emailProviderProfiles.tenantId} = ${tenants.id}
            and ${emailProviderProfiles.isActive} = 1
            and ${emailProviderProfiles.targetType} in ('provider', 'distributor')
          )
        )`
      })
      .from(tenants)
      .where(eq(tenants.parentTenantId, tenantId))
    
    childTenants = legacyChildren
  }

  // Get organizations (for providers) with email override status
  const orgs = tenant.type === 'provider'
    ? await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          status: organizations.status,
          tenantId: organizations.tenantId,
          createdAt: organizations.createdAt,
          hasEmailOverride: sql<boolean>`(
            select exists(
              select 1
              from ${emailProviderProfiles}
              where ${emailProviderProfiles.organizationId} = ${organizations.id}
              and ${emailProviderProfiles.isActive} = 1
              and ${emailProviderProfiles.targetType} = 'organization'
            )
          )`
        })
        .from(organizations)
        .where(eq(organizations.tenantId, tenantId))
    : []

  // Get tenant invitations
  const isSqlite = (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'
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
    let willCreateOrganization = false
    let organizationName: string | undefined = undefined
    
    if (row.organizationData) {
      try {
        const organizationData = JSON.parse(row.organizationData)
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

  // Clean up accepted and cancelled invitations older than 24 hours
  const cleanupCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
  await db
    .delete(tenantInvitations)
    .where(
      and(
        eq(tenantInvitations.tenantId, tenantId),
        inArray(tenantInvitations.status, ['accepted', 'cancelled']),
        lt(tenantInvitations.updatedAt, cleanupCutoff)
      )
    )

  const response = {
    tenant,
    members,
    childTenants,
    linkedTenants, // Providers for Distributors, Distributors for Providers
    organizations: orgs,
    invites: invitations
  }

  // Debug logging in development
  if (import.meta.dev) {
    console.log('[API] Tenant members response:', {
      tenantId,
      memberCount: members.length,
      members: members.map(m => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        status: m.status,
        email: m.user?.email
      }))
    })
  }

  return response
})

