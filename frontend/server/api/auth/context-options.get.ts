import { defineEventHandler } from 'h3'
import { eq, and, inArray } from 'drizzle-orm'
import { ensureAuthState } from '../../utils/session'
import { getDb } from '../../utils/db'
import { organizations, tenants, tenantMemberships } from '../../database/schema'
import { canAccessTenant, canAccessOrganization } from '../../utils/rbac'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    return {
      tenants: [],
      organizations: [],
      tenantOrganizations: {}
    }
  }

  const db = getDb()

  // Get all accessible organizations (direct + via tenant hierarchy)
  // But only include those that user can actually switch context to
  const accessibleOrgIds = new Set<string>()
  const orgsForTenantHierarchy: Array<{ id: string; tenantId: string | null }> = []
  
  // Direct organization memberships - these can always be switched to
  for (const orgId of Object.keys(auth.orgRoles)) {
    accessibleOrgIds.add(orgId)
  }

  // Organizations accessible via tenant hierarchy
  // IMPORTANT: For context switching, we should ONLY show organizations where user has DIRECT membership
  // Even if user can see organizations via tenant hierarchy (with includeChildren), they should not
  // appear in context switcher unless user has direct membership. This is because:
  // - Tenant membership with includeChildren = administrative access (can manage, but not work in)
  // - Direct organization membership = can actually work in the organization (context switch)
  const tenantIds = Object.keys(auth.tenantRoles)
  for (const tenantId of tenantIds) {
    const includeChildren = auth.tenantIncludeChildren?.[tenantId] ?? false
    if (!includeChildren) {
      continue
    }

    // Get all organizations under this tenant
    const orgs = await db
      .select({ id: organizations.id, tenantId: organizations.tenantId })
      .from(organizations)
      .where(eq(organizations.tenantId, tenantId))

    for (const org of orgs) {
      // ONLY show if user has DIRECT membership (not just via tenant hierarchy)
      // This prevents showing orgs user can't actually switch context to
      if (auth.orgRoles[org.id]) {
        orgsForTenantHierarchy.push(org)
      }
    }
  }

  // Fetch full organization details for direct memberships (standalone orgs)
  // Only include active organizations (or all for super admins)
  const orgsList = Array.from(accessibleOrgIds)
  const orgsData = orgsList.length > 0
    ? await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          tenantId: organizations.tenantId,
          status: organizations.status
        })
        .from(organizations)
        .where(
          auth.user.isSuperAdmin
            ? inArray(organizations.id, orgsList)
            : and(
                inArray(organizations.id, orgsList),
                eq(organizations.status, 'active')
              )
        )
    : []

  // Fetch full organization details for tenant hierarchy orgs
  // Only include active organizations (or all for super admins)
  const tenantOrgIds = orgsForTenantHierarchy.map(o => o.id)
  const tenantOrgsData = tenantOrgIds.length > 0
    ? await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          tenantId: organizations.tenantId,
          status: organizations.status
        })
        .from(organizations)
        .where(
          auth.user.isSuperAdmin
            ? inArray(organizations.id, tenantOrgIds)
            : and(
                inArray(organizations.id, tenantOrgIds),
                eq(organizations.status, 'active')
              )
        )
    : []

  // Group organizations by tenant, but ONLY for tenants where user has membership
  // Organizations belonging to tenants where user lacks membership should be shown as standalone
  const userTenantIds = new Set(Object.keys(auth.tenantRoles))
  const allOrgsWithTenantId = new Map<string, typeof tenantOrgsData[0]>()
  
  // Add organizations from tenantOrgsData (these are already filtered to tenants with membership)
  for (const org of tenantOrgsData) {
    if (org.tenantId) {
      allOrgsWithTenantId.set(org.id, org)
    }
  }
  
  // Add organizations from orgsData that have a tenantId AND user has membership in that tenant
  // If user lacks membership in the tenant, the organization will be shown as standalone
  for (const org of orgsData) {
    if (org.tenantId && userTenantIds.has(org.tenantId)) {
      // Use orgsData version as it's more complete (from direct membership)
      allOrgsWithTenantId.set(org.id, org)
    }
  }
  
  // Now group them by tenantId (only tenants where user has membership)
  const tenantOrganizations: Record<string, typeof tenantOrgsData> = {}
  for (const org of allOrgsWithTenantId.values()) {
    if (org.tenantId && userTenantIds.has(org.tenantId)) {
      if (!tenantOrganizations[org.tenantId]) {
        tenantOrganizations[org.tenantId] = []
      }
      tenantOrganizations[org.tenantId].push(org)
    }
  }

  // Collect all organization IDs that are in tenantOrganizations
  const allOrgIdsInTenants = new Set<string>()
  for (const orgs of Object.values(tenantOrganizations)) {
    for (const org of orgs) {
      allOrgIdsInTenants.add(org.id)
    }
  }
  
  // Filter organizations to only include standalone orgs (those without tenantId or not in tenantOrganizations)
  // Verify each organization is still accessible (double-check)
  const accessibleStandaloneOrgs: Array<{
    id: string
    name: string
    slug: string
    tenantId: string | null
    status: string
  }> = []
  
  for (const org of orgsData) {
    // Skip if already in tenantOrganizations
    if (allOrgIdsInTenants.has(org.id)) {
      continue
    }
    
    // Double-check that user can actually access this org
    const canAccess = await canAccessOrganization(auth, org.id)
    if (canAccess) {
      accessibleStandaloneOrgs.push(org)
    }
  }

  // Map to AuthOrganization format with metadata from auth state
  const mappedOrgs = accessibleStandaloneOrgs.map(org => {
    // Find the corresponding auth organization to get role and other metadata
    const authOrg = auth.organizations.find(ao => ao.id === org.id)
    if (authOrg) {
      return authOrg
    }
    // Fallback if not found in auth state (shouldn't happen, but be safe)
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: 'viewer' as const,
      status: org.status,
      isSuspended: false,
      logoUrl: null,
      requireSso: false,
      hasLocalLoginOverride: false,
      tenantId: org.tenantId
    }
  })

  // Map tenantOrganizations to include full AuthOrganization metadata
  const mappedTenantOrganizations: Record<string, any[]> = {}
  for (const [tenantId, orgs] of Object.entries(tenantOrganizations)) {
    mappedTenantOrganizations[tenantId] = orgs.map(org => {
      // Find the corresponding auth organization to get role and other metadata
      const authOrg = auth.organizations.find(ao => ao.id === org.id)
      if (authOrg) {
        return authOrg
      }
      // Fallback if not found in auth state (shouldn't happen, but be safe)
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: 'viewer' as const,
        status: org.status,
        isSuspended: false,
        logoUrl: null,
        requireSso: false,
        hasLocalLoginOverride: false,
        tenantId: org.tenantId
      }
    })
  }

  return {
    tenants: auth.tenants,
    organizations: mappedOrgs,
    tenantOrganizations: mappedTenantOrganizations
  }
})

