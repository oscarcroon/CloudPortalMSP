// @ts-nocheck
import { defineEventHandler } from 'h3'
import { requireSession } from '../../utils/session'
import { getDb } from '../../utils/db'
import { organizations, tenantMemberships, tenants } from '../../database/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { tenantRoleOrgProxyPermissions } from '~/constants/rbac'
import type { TenantRole, RbacRole } from '~/constants/rbac'

export default defineEventHandler(async (event) => {
  const auth = await requireSession(event)
  const db = getDb()
  
  // Get current org details
  const currentOrgId = auth.currentOrgId
  const currentOrg = auth.organizations.find((org) => org.id === currentOrgId)
  
  // Check 1: Verify tenantIncludeChildren in database
  const tenantIds = Object.keys(auth.tenantRoles)
  const dbTenantMemberships = tenantIds.length > 0
    ? await db
        .select({
          tenantId: tenantMemberships.tenantId,
          role: tenantMemberships.role,
          includeChildren: tenantMemberships.includeChildren,
          status: tenantMemberships.status
        })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.userId, auth.user.id),
            inArray(tenantMemberships.tenantId, tenantIds),
            eq(tenantMemberships.status, 'active')
          )
        )
    : []

  const dbTenantIncludeChildren: Record<string, boolean> = {}
  for (const membership of dbTenantMemberships) {
    dbTenantIncludeChildren[membership.tenantId] = Boolean(membership.includeChildren)
  }

  // Check 2: Get all active orgs under tenants where user has includeChildren
  const tenantIdsWithIncludeChildren = tenantIds.filter(
    (tenantId) => auth.tenantIncludeChildren?.[tenantId] ?? false
  )

  const dbOrgsUnderTenants = tenantIdsWithIncludeChildren.length > 0
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
          and(
            inArray(organizations.tenantId, tenantIdsWithIncludeChildren),
            eq(organizations.status, 'active')
          )
        )
    : []

  // Check 3: Test deriveProxyRoleForTenant for each tenant
  const allowedProxyTenantTypes = new Set(['provider', 'distributor'])
  const deriveProxyRoleForTenant = (tenantId: string): { role: RbacRole | null; reason: string } => {
    const tenantRole = auth.tenantRoles?.[tenantId] as TenantRole | undefined
    const includeChildren = auth.tenantIncludeChildren?.[tenantId] ?? false
    const tenant = auth.tenants.find((t) => t.id === tenantId)

    if (!tenantId) {
      return { role: null, reason: 'No tenantId provided' }
    }
    if (!tenantRole) {
      return { role: null, reason: `No tenantRole found for tenant ${tenantId}` }
    }
    if (!includeChildren) {
      return { role: null, reason: `includeChildren is false for tenant ${tenantId}` }
    }
    if (!tenant) {
      return { role: null, reason: `Tenant ${tenantId} not found in auth.tenants` }
    }
    if (!allowedProxyTenantTypes.has(tenant.type)) {
      return { role: null, reason: `Tenant type ${tenant.type} is not allowed (must be provider or distributor)` }
    }

    const proxyPermissions = tenantRoleOrgProxyPermissions[tenantRole] ?? []
    if (proxyPermissions.includes('org:manage')) {
      return { role: 'admin', reason: `Tenant role ${tenantRole} has org:manage permission` }
    }
    if (proxyPermissions.includes('org:read')) {
      return { role: 'viewer', reason: `Tenant role ${tenantRole} has org:read permission` }
    }
    return { role: null, reason: `Tenant role ${tenantRole} has no org proxy permissions` }
  }

  const proxyRoleTests = tenantIdsWithIncludeChildren.map((tenantId) => {
    const tenant = auth.tenants.find((t) => t.id === tenantId)
    const result = deriveProxyRoleForTenant(tenantId)
    return {
      tenantId,
      tenantName: tenant?.name,
      tenantType: tenant?.type,
      tenantRole: auth.tenantRoles?.[tenantId],
      includeChildren: auth.tenantIncludeChildren?.[tenantId],
      dbIncludeChildren: dbTenantIncludeChildren[tenantId],
      proxyRole: result.role,
      reason: result.reason,
      proxyPermissions: auth.tenantRoles?.[tenantId] 
        ? tenantRoleOrgProxyPermissions[auth.tenantRoles[tenantId] as TenantRole] ?? []
        : []
    }
  })

  // Get tenant info for current org
  let tenantInfo = null
  if (currentOrg?.tenantId) {
    const tenantId = currentOrg.tenantId
    const tenant = auth.tenants.find((t) => t.id === tenantId)
    const tenantRole = auth.tenantRoles?.[tenantId]
    const includeChildren = auth.tenantIncludeChildren?.[tenantId] ?? false
    const proxyRoleResult = deriveProxyRoleForTenant(tenantId)
    
    tenantInfo = {
      tenantId,
      tenantRole,
      includeChildren,
      dbIncludeChildren: dbTenantIncludeChildren[tenantId],
      tenantType: tenant?.type,
      tenantName: tenant?.name,
      hasTenantMembership: !!tenant,
      proxyRole: proxyRoleResult.role,
      proxyRoleReason: proxyRoleResult.reason
    }
  }
  
  return {
    userId: auth.user.id,
    currentOrgId,
    currentOrg: currentOrg ? {
      id: currentOrg.id,
      name: currentOrg.name,
      tenantId: currentOrg.tenantId,
      role: currentOrgId ? auth.orgRoles[currentOrgId] : null
    } : null,
    orgRoles: auth.orgRoles,
    tenantRoles: auth.tenantRoles,
    tenantIncludeChildren: auth.tenantIncludeChildren,
    tenants: auth.tenants.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      role: auth.tenantRoles?.[t.id],
      includeChildren: auth.tenantIncludeChildren?.[t.id] ?? false
    })),
    tenantInfo,
    organizations: auth.organizations.map(org => ({
      id: org.id,
      name: org.name,
      tenantId: org.tenantId,
      role: auth.orgRoles[org.id]
    })),
    // Check 1: Database tenant memberships
    dbTenantMemberships: dbTenantMemberships.map((m: any) => ({
      tenantId: m.tenantId,
      role: m.role,
      includeChildren: Boolean(m.includeChildren),
      status: m.status
    })),
    dbTenantIncludeChildren,
    // Check 2: Active orgs under tenants
    tenantIdsWithIncludeChildren,
    dbOrgsUnderTenants: dbOrgsUnderTenants.map((org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      tenantId: org.tenantId,
      status: org.status
    })),
    // Check 3: Proxy role tests
    proxyRoleTests
  }
})

