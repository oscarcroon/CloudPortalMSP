import { eq, sql } from 'drizzle-orm'
import { defineEventHandler, getRouterParam } from 'h3'
import { tenants, tenantMemberships, users, organizations, emailProviderProfiles } from '../../../../database/schema'
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

  // Get child tenants (distributors for providers) with email override status
  const childTenants = await db
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

  // Get organizations (for distributors) with email override status
  const orgs = tenant.type === 'distributor'
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

  return {
    tenant,
    members,
    childTenants,
    organizations: orgs
  }
})

