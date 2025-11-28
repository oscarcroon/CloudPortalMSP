import { and, desc, eq, like, or, sql, inArray } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import {
  organizationAuthSettings,
  organizationMemberships,
  organizations,
  tenants,
  emailProviderProfiles
} from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { ensureAuthState } from '../../../utils/session'
import { canAccessOrganization, canAccessTenant } from '../../../utils/rbac'

const querySchema = z.object({
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
})

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const { q, limit = 50 } = querySchema.parse(getQuery(event))
  const db = getDb()

  // Get accessible tenant IDs
  let accessibleTenantIds: string[] = []
  if (auth.user.isSuperAdmin) {
    // Super admins can see all
    const allTenants = await db.select({ id: tenants.id }).from(tenants)
    accessibleTenantIds = allTenants.map((t) => t.id)
  } else {
    // Get all tenants user has access to (directly or via hierarchy)
    const allTenants = await db.select().from(tenants)
    for (const tenant of allTenants) {
      let hasAccess = false
      // Check direct membership
      if (auth.tenantRoles[tenant.id]) {
        hasAccess = true
      } else {
        // Check via hierarchy (only if includeChildren is true)
        for (const userTenantId of Object.keys(auth.tenantRoles)) {
          const includeChildren = auth.tenantIncludeChildren?.[userTenantId] ?? false
          if (includeChildren && (await canAccessTenant(auth, userTenantId, tenant.id))) {
            hasAccess = true
            break
          }
        }
      }
      if (hasAccess) {
        accessibleTenantIds.push(tenant.id)
      }
    }
  }

  // Also include organizations where user has direct membership
  const userOrgIds = Object.keys(auth.orgRoles)

  let query = db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      status: organizations.status,
      requireSso: organizations.requireSso,
      defaultRole: organizations.defaultRole,
      billingEmail: organizations.billingEmail,
      tenantId: organizations.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      createdAt: organizations.createdAt,
      memberCount: sql<number>`count(${organizationMemberships.id})`,
      ssoEnforced: organizationAuthSettings.ssoEnforced,
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
    .leftJoin(
      organizationAuthSettings,
      eq(organizationAuthSettings.organizationId, organizations.id)
    )
    .leftJoin(
      tenants,
      eq(tenants.id, organizations.tenantId)
    )
    .groupBy(
      organizations.id,
      organizations.name,
      organizations.slug,
      organizations.status,
      organizations.requireSso,
      organizations.defaultRole,
      organizations.billingEmail,
      organizations.tenantId,
      organizations.createdAt,
      organizationAuthSettings.ssoEnforced,
      tenants.name,
      tenants.slug
    )
    .orderBy(desc(organizations.createdAt))
    .limit(limit)

  // Filter by accessible tenants or direct membership
  // Super admins see all organizations
  const whereConditions: any[] = []
  if (!auth.user.isSuperAdmin) {
    if (accessibleTenantIds.length > 0) {
      whereConditions.push(inArray(organizations.tenantId, accessibleTenantIds))
    }
    if (userOrgIds.length > 0) {
      whereConditions.push(inArray(organizations.id, userOrgIds))
    }

    if (whereConditions.length === 0) {
      // User has no access to any organizations
      return { organizations: [] }
    }
  }

  // Apply search filter
  if (q && q.trim()) {
    const pattern = `%${q.trim()}%`
    const searchCondition = or(like(organizations.name, pattern), like(organizations.slug, pattern))
    
    if (!auth.user.isSuperAdmin && whereConditions.length > 0) {
      query = query.where(
        and(or(...whereConditions), searchCondition)
      ) as typeof query
    } else {
      query = query.where(searchCondition) as typeof query
    }
  } else if (!auth.user.isSuperAdmin && whereConditions.length > 0) {
    // Apply access filter even without search
    query = query.where(or(...whereConditions)) as typeof query
  }

  const rows = await query

  // For super admins, return all organizations without additional filtering
  if (auth.user.isSuperAdmin) {
    return {
      organizations: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        requireSso: Boolean(row.requireSso),
        defaultRole: row.defaultRole,
        billingEmail: row.billingEmail,
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        tenantSlug: row.tenantSlug,
        createdAt: row.createdAt,
        memberCount: row.memberCount,
        ssoEnforced: Boolean(row.ssoEnforced),
        hasEmailOverride: Boolean(row.hasEmailOverride)
      }))
    }
  }

  // Filter results based on access for non-super-admins
  const accessibleOrgs = []
  for (const row of rows) {
    // Check direct membership
    if (auth.orgRoles[row.id]) {
      accessibleOrgs.push(row)
      continue
    }

    // Check tenant access
    if (row.tenantId && (await canAccessOrganization(auth, row.id))) {
      accessibleOrgs.push(row)
    }
  }

  return {
    organizations: accessibleOrgs.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      requireSso: Boolean(row.requireSso),
      defaultRole: row.defaultRole,
      billingEmail: row.billingEmail,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      tenantSlug: row.tenantSlug,
      createdAt: row.createdAt,
      memberCount: row.memberCount,
      ssoEnforced: Boolean(row.ssoEnforced),
      hasEmailOverride: Boolean(row.hasEmailOverride)
    }))
  }
})

