import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { tenants, tenantMemberships, organizations, emailProviderProfiles } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { ensureAuthState } from '../../../utils/session'
import { canAccessTenant } from '../../../utils/rbac'

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

  return accessibleTenants
})

