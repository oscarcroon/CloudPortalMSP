import { and, desc, eq, like, or, sql, inArray } from 'drizzle-orm'
import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { tenants, tenantMemberships, organizations, organizationMemberships, emailProviderProfiles, distributorProviders } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { ensureAuthState } from '../../../utils/session'
import { canAccessTenant } from '../../../utils/rbac'

// Helper to get distributor-provider links for accessible tenants
async function getDistributorProviderLinks(accessibleTenantIds: string[]) {
  const db = getDb()
  const links = await db
    .select({
      distributorId: distributorProviders.distributorId,
      providerId: distributorProviders.providerId
    })
    .from(distributorProviders)
    .where(
      or(
        inArray(distributorProviders.distributorId, accessibleTenantIds),
        inArray(distributorProviders.providerId, accessibleTenantIds)
      )
    )
  
  return links
}

const querySchema = z.object({
  q: z.string().max(120).optional(),
  type: z.enum(['provider', 'distributor', 'organization']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
})

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const { q, type, limit = 50 } = querySchema.parse(getQuery(event))
  const db = getDb()

  let query = db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      type: tenants.type,
      parentTenantId: tenants.parentTenantId,
      status: tenants.status,
      createdAt: tenants.createdAt,
      memberCount: sql<number>`count(distinct ${tenantMemberships.id})`,
      organizationCount: sql<number>`(
        select count(*) 
        from ${organizations} 
        where ${organizations.tenantId} = ${tenants.id}
      )`,
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
    .leftJoin(
      tenantMemberships,
      and(
        eq(tenantMemberships.tenantId, tenants.id),
        eq(tenantMemberships.status, 'active')
      )
    )
    .groupBy(
      tenants.id,
      tenants.name,
      tenants.slug,
      tenants.type,
      tenants.parentTenantId,
      tenants.status,
      tenants.createdAt
    )
    .orderBy(desc(tenants.createdAt))
    .limit(limit)

  // Filter by type if provided
  if (type) {
    query = query.where(eq(tenants.type, type)) as typeof query
  }

  // Filter by search query if provided
  if (q && q.trim()) {
    const pattern = `%${q.trim()}%`
    const existingWhere = type ? eq(tenants.type, type) : undefined
    query = query.where(
      existingWhere
        ? and(existingWhere, or(like(tenants.name, pattern), like(tenants.slug, pattern)))
        : or(like(tenants.name, pattern), like(tenants.slug, pattern))
    ) as typeof query
  }

  const allTenants = await query

  // Filter tenants based on user's access
  const accessibleTenants = []
  for (const tenant of allTenants) {
    // Super admins can see all
    if (auth.user.isSuperAdmin) {
      accessibleTenants.push(tenant)
      continue
    }

    // Check if user has direct tenant membership
    const userRole = auth.tenantRoles[tenant.id]
    if (userRole) {
      // User has direct membership - they can see their own tenant
      accessibleTenants.push(tenant)
      continue
    }

    // Check if user can access via hierarchy (only if includeChildren is true)
    let hasAccess = false
    for (const userTenantId of Object.keys(auth.tenantRoles)) {
      const includeChildren = auth.tenantIncludeChildren?.[userTenantId] ?? false
      // Only users with includeChildren can see other tenants via hierarchy
      if (includeChildren) {
        if (await canAccessTenant(auth, userTenantId, tenant.id)) {
          hasAccess = true
          break
        }
      }
    }

    if (hasAccess) {
      accessibleTenants.push(tenant)
    }
  }

  // Get organizations for providers (organizations are now linked to providers, not distributors)
  // First, get all accessible providers (directly or via distributor links)
  const accessibleProviderIds: string[] = []
  
  // Direct provider access
  const directProviders = accessibleTenants
    .filter(t => t.type === 'provider')
    .map(t => t.id)
  accessibleProviderIds.push(...directProviders)
  
  // Providers accessible via distributors
  const accessibleDistributorIds = accessibleTenants
    .filter(t => t.type === 'distributor')
    .map(t => t.id)
  
  if (accessibleDistributorIds.length > 0) {
    const providerLinks = await db
      .select({ providerId: distributorProviders.providerId })
      .from(distributorProviders)
      .where(inArray(distributorProviders.distributorId, accessibleDistributorIds))
    
    for (const link of providerLinks) {
      if (!accessibleProviderIds.includes(link.providerId)) {
        accessibleProviderIds.push(link.providerId)
      }
    }
  }

  let orgsList: any[] = []
  if (accessibleProviderIds.length > 0 || auth.user.isSuperAdmin) {
    const orgsQuery = db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
        tenantId: organizations.tenantId,
        createdAt: organizations.createdAt,
        memberCount: sql<number>`count(distinct ${organizationMemberships.id})`,
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
      .leftJoin(
        organizationMemberships,
        and(
          eq(organizationMemberships.organizationId, organizations.id),
          eq(organizationMemberships.status, 'active')
        )
      )
      .where(
        auth.user.isSuperAdmin
          ? undefined
          : inArray(organizations.tenantId, accessibleProviderIds)
      )
      .groupBy(
        organizations.id,
        organizations.name,
        organizations.slug,
        organizations.status,
        organizations.tenantId,
        organizations.createdAt
      )

    orgsList = await orgsQuery
  }

  // Get distributor-provider links for building tree structure
  const distributorProviderLinks = await getDistributorProviderLinks(
    accessibleTenants.map(t => t.id)
  )

  return {
    tenants: accessibleTenants,
    organizations: orgsList,
    distributorProviderLinks // Include junction table data for frontend tree building
  }
})

