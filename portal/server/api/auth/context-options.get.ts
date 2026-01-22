// @ts-nocheck
import { defineEventHandler } from 'h3'
import { eq, and, inArray } from 'drizzle-orm'
import { ensureAuthState } from '../../utils/session'
import { getDb } from '../../utils/db'
import { organizations, tenants } from '../../database/schema'
import { canAccessTenant, canAccessOrganization } from '../../utils/rbac'
import type { RbacRole, TenantRole } from '~/constants/rbac'
import { tenantRoleOrgProxyPermissions } from '~/constants/rbac'

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

  const accessibleOrgIds = new Set<string>()
  for (const orgId of Object.keys(auth.orgRoles)) {
    accessibleOrgIds.add(orgId)
  }
  const tenantIds = Object.keys(auth.tenantRoles)
  const includeChildrenTenantIds = tenantIds.filter(
    (tenantId) => auth.tenantIncludeChildren?.[tenantId]
  )

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

  const tenantOrgsData =
    includeChildrenTenantIds.length > 0
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
              ? inArray(organizations.tenantId, includeChildrenTenantIds)
              : and(
                  inArray(organizations.tenantId, includeChildrenTenantIds),
                  eq(organizations.status, 'active')
                )
          )
      : []

  const userTenantIds = new Set(Object.keys(auth.tenantRoles))
  
  // For superadmins: also include current tenant if selected
  if (auth.user.isSuperAdmin && auth.currentTenantId) {
    userTenantIds.add(auth.currentTenantId)
  }
  
  const tenantOrganizations: Record<string, Array<typeof orgsData[number] & { accessType: 'direct' | 'msp' }>> =
    {}

  const allowedProxyTenantTypes = new Set(['provider', 'distributor'])

  const resolveProxyRole = (tenantId?: string | null): { role: RbacRole; accessType: 'direct' | 'msp' } => {
    if (!tenantId) {
      return { role: 'viewer', accessType: 'msp' }
    }
    const tenantRole = auth.tenantRoles?.[tenantId] as TenantRole | undefined
    const includeChildren = auth.tenantIncludeChildren?.[tenantId]
    const tenantInfo = auth.tenants.find((tenant) => tenant.id === tenantId)
    if (
      !tenantRole ||
      !includeChildren ||
      !tenantInfo ||
      !allowedProxyTenantTypes.has(tenantInfo.type)
    ) {
      return { role: 'viewer', accessType: 'msp' }
    }
    const proxyPermissions = tenantRoleOrgProxyPermissions[tenantRole] ?? []
    if (proxyPermissions.includes('org:manage')) {
      return { role: 'admin', accessType: 'msp' }
    }
    if (proxyPermissions.includes('org:read')) {
      return { role: 'viewer', accessType: 'msp' }
    }
    return { role: 'viewer', accessType: 'msp' }
  }

  const buildOrgPayload = (
    org: typeof orgsData[number],
    accessType: 'direct' | 'msp'
  ) => {
    const authOrg = auth.organizations.find((ao) => ao.id === org.id)
    if (authOrg) {
      return { ...authOrg, accessType: authOrg.accessType ?? accessType }
    }
    const proxyRole = resolveProxyRole(org.tenantId)
    const resolvedRole = accessType === 'msp' ? proxyRole : { role: 'viewer' as RbacRole, accessType }
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: resolvedRole.role,
      status: org.status,
      isSuspended: org.status !== 'active',
      logoUrl: null,
      requireSso: false,
      hasLocalLoginOverride: false,
      tenantId: org.tenantId,
      accessType: resolvedRole.accessType
    }
  }

  const upsertTenantOrg = (
    org: typeof orgsData[number],
    accessType: 'direct' | 'msp'
  ) => {
    if (!org.tenantId || !userTenantIds.has(org.tenantId)) {
      return
    }
    if (!tenantOrganizations[org.tenantId]) {
      tenantOrganizations[org.tenantId] = []
    }
    const payload = buildOrgPayload(org, accessType)
    const existingIndex = tenantOrganizations[org.tenantId].findIndex(
      (existing) => existing.id === payload.id
    )
    if (existingIndex >= 0) {
      tenantOrganizations[org.tenantId][existingIndex] = payload
    } else {
      tenantOrganizations[org.tenantId].push(payload)
    }
  }

  for (const org of tenantOrgsData) {
    upsertTenantOrg(org, 'msp')
  }

  for (const org of orgsData) {
    if (org.tenantId && userTenantIds.has(org.tenantId)) {
      upsertTenantOrg(org, 'direct')
    }
  }

  // For superadmins: fetch ALL provider tenants and their organizations
  // This ensures superadmins can see and switch to any organization in any provider
  if (auth.user.isSuperAdmin) {
    // Fetch all provider-type tenants
    const allProviderTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        type: tenants.type,
        parentTenantId: tenants.parentTenantId,
        status: tenants.status
      })
      .from(tenants)
      .where(eq(tenants.type, 'provider'))

    // Collect all provider tenant IDs
    const providerTenantIds = allProviderTenants.map(t => t.id)

    // Fetch all organizations under any provider tenant
    const superAdminAllOrgs = providerTenantIds.length > 0
      ? await db
          .select({
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            tenantId: organizations.tenantId,
            status: organizations.status
          })
          .from(organizations)
          .where(inArray(organizations.tenantId, providerTenantIds))
      : []

    // Group organizations by tenant and add to tenantOrganizations
    for (const org of superAdminAllOrgs) {
      if (!org.tenantId) continue

      // Ensure tenant is in userTenantIds so it shows up in the context switcher
      userTenantIds.add(org.tenantId)

      if (!tenantOrganizations[org.tenantId]) {
        tenantOrganizations[org.tenantId] = []
      }

      const existingIndex = tenantOrganizations[org.tenantId].findIndex(
        (existing) => existing.id === org.id
      )
      if (existingIndex < 0) {
        // Add org with admin role for superadmins
        tenantOrganizations[org.tenantId].push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: 'admin' as RbacRole,
          status: org.status,
          isSuspended: org.status !== 'active',
          logoUrl: null,
          requireSso: false,
          hasLocalLoginOverride: true,
          tenantId: org.tenantId,
          accessType: 'msp'
        } as any)
      }
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
  const mappedOrgs = accessibleStandaloneOrgs.map(org => buildOrgPayload(org, 'direct'))

  const mappedTenantOrganizations: Record<string, any[]> = {}
  for (const [tenantId, orgs] of Object.entries(tenantOrganizations)) {
    mappedTenantOrganizations[tenantId] = orgs
  }

  // For superadmins: include all provider and distributor tenants
  let tenantsToReturn = auth.tenants
  if (auth.user.isSuperAdmin) {
    // Fetch all provider and distributor tenants
    const allTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        type: tenants.type,
        parentTenantId: tenants.parentTenantId,
        status: tenants.status
      })
      .from(tenants)

    // Build a set of existing tenant IDs
    const existingTenantIds = new Set(auth.tenants.map(t => t.id))

    // Add missing tenants to the list
    const additionalTenants = allTenants
      .filter(t => !existingTenantIds.has(t.id))
      .map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        type: t.type as 'provider' | 'distributor' | 'organization',
        parentTenantId: t.parentTenantId ?? null,
        role: 'admin' as TenantRole,
        includeChildren: true,
        status: t.status
      }))

    tenantsToReturn = [...auth.tenants, ...additionalTenants]
  }

  return {
    tenants: tenantsToReturn,
    organizations: mappedOrgs,
    tenantOrganizations: mappedTenantOrganizations
  }
})

