import { createError, H3Event } from 'h3'
import type { RbacPermission, RbacRole, TenantRole } from '~/constants/rbac'
import { rolePermissionMap, tenantRolePermissionMap } from '~/constants/rbac'
import { ensureAuthState } from './session'
import { getDb } from './db'
import { eq, or, and } from 'drizzle-orm'
import { organizations, tenants, distributorProviders } from '../database/schema'
import { getModuleIdFromPermission } from '~/constants/modules'
import { isModulePermissionAllowed as checkModulePolicy } from './modulePolicy'
import { logPermissionDenied } from './audit'

export const hasPermission = (role: RbacRole, permission: RbacPermission) =>
  rolePermissionMap[role]?.includes(permission) ?? false

export const hasTenantPermission = (role: TenantRole, permission: RbacPermission) =>
  tenantRolePermissionMap[role]?.includes(permission) ?? false

/**
 * Centralized permission checker that uses both org and tenant memberships
 * Uses current context (currentOrgId/currentTenantId) from auth state
 */
export const requirePermission = async (
  event: H3Event,
  permission: RbacPermission,
  targetOrgId?: string
) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }
  const orgId = targetOrgId ?? auth.currentOrgId
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Select an organization' })
  }

  if (auth.user.isSuperAdmin) {
    return { auth, role: 'owner', orgId }
  }

  // 1. Check direct organization membership
  const directRole = auth.orgRoles[orgId]
  let hasRbacPermission = false
  let effectiveRole: RbacRole | undefined

  if (directRole && hasPermission(directRole, permission)) {
    hasRbacPermission = true
    effectiveRole = directRole
  }

  // 2. Check if user can access organization via tenant hierarchy
  if (!hasRbacPermission) {
    const hasAccess = await canAccessOrganization(auth, orgId)
    if (!hasAccess) {
      await logPermissionDenied(event, permission, 'no_organization_access', orgId)
      throw createError({
        statusCode: 403,
        message: `Missing permission ${permission} for organization ${orgId}`
      })
    }

    // 3. Check tenant permissions for tenant-level permissions
    if (permission.startsWith('tenants:') || permission.startsWith('org:manage')) {
      // For tenant-level permissions, check tenant roles
      const [org] = await getDb()
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))

      if (org?.tenantId) {
        for (const [tenantId, tenantRole] of Object.entries(auth.tenantRoles)) {
          const includeChildren = auth.tenantIncludeChildren?.[tenantId] ?? false
          if (!includeChildren && tenantId !== org.tenantId) {
            continue
          }

          if (
            (await canAccessTenant(auth, tenantId, org.tenantId)) &&
            hasTenantPermission(tenantRole, permission)
          ) {
            // Grant owner-level access when accessing via tenant hierarchy
            hasRbacPermission = true
            effectiveRole = 'owner'
            break
          }
        }
      }
    } else {
      // For organization-level permissions accessed via tenant, grant owner-level access
      // User already has access via tenant hierarchy (checked above)
      hasRbacPermission = true
      effectiveRole = 'owner'
    }
  }

  if (!hasRbacPermission) {
    await logPermissionDenied(event, permission, 'missing_rbac_permission', orgId)
    throw createError({
      statusCode: 403,
      message: `Missing permission ${permission} for organization ${orgId}`
    })
  }

  // 4. Check module policy (if permission belongs to a module)
  const moduleId = getModuleIdFromPermission(permission)
  if (moduleId) {
    const modulePolicyAllowed = await checkModulePolicy(orgId, moduleId, permission)
    if (!modulePolicyAllowed) {
      await logPermissionDenied(event, permission, 'module_policy_denied', orgId, undefined)
      throw createError({
        statusCode: 403,
        message: `Module policy denies permission ${permission} for organization ${orgId}`
      })
    }

    // 5. Check user-specific module permissions (can only restrict)
    const { getUserModuleDeniedPermissions } = await import('./userModulePermissions')
    const userDenials = await getUserModuleDeniedPermissions(orgId, auth.user.id, moduleId)
    if (userDenials && userDenials.has(permission)) {
      await logPermissionDenied(event, permission, 'user_module_policy_denied', orgId, undefined)
      throw createError({
        statusCode: 403,
        message: `User-specific module policy denies permission ${permission} for organization ${orgId}`
      })
    }
  }

  return { auth, role: effectiveRole!, orgId }
}

export const requireSuperAdmin = async (event: H3Event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.user.isSuperAdmin) {
    throw createError({ statusCode: 403, message: 'Super admin required' })
  }
  return auth
}

export const requireTenantPermission = async (
  event: H3Event,
  permission: RbacPermission,
  targetTenantId?: string
) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  if (auth.user.isSuperAdmin) {
    return { auth, role: 'admin' as TenantRole, tenantId: targetTenantId }
  }

  // Check tenant permissions
  if (targetTenantId) {
    const role = auth.tenantRoles[targetTenantId]
    if (role && hasTenantPermission(role, permission)) {
      return { auth, role, tenantId: targetTenantId }
    }
  }

  // Check if user has permission in any tenant
  for (const [tenantId, role] of Object.entries(auth.tenantRoles)) {
    if (hasTenantPermission(role, permission)) {
      // If targetTenantId is specified, check hierarchy
      if (targetTenantId && !(await canAccessTenant(auth, tenantId, targetTenantId))) {
        continue
      }
      return { auth, role, tenantId: targetTenantId ?? tenantId }
    }
  }

  throw createError({
    statusCode: 403,
    message: `Missing tenant permission ${permission}`
  })
}

export const canAccessTenant = async (
  auth: Awaited<ReturnType<typeof ensureAuthState>>,
  userTenantId: string,
  targetTenantId: string
): Promise<boolean> => {
  if (!auth || auth.user.isSuperAdmin) {
    return true
  }

  if (userTenantId === targetTenantId) {
    return true
  }

  const db = getDb()
  const [userTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, userTenantId))

  const [targetTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, targetTenantId))

  if (!userTenant || !targetTenant) {
    return false
  }

  // Check if user has includeChildren enabled for this tenant
  const includeChildren = auth.tenantIncludeChildren?.[userTenantId] ?? false
  
  // If includeChildren is false, user can only access their own tenant
  if (!includeChildren) {
    return false
  }

  // Handle many-to-many relation: Distributor -> Provider
  // If user has access to a Distributor, they can access Providers linked to that Distributor
  // NOTE: Providers should NOT be able to access Distributors (one-way relationship)
  if (userTenant.type === 'distributor' && targetTenant.type === 'provider') {
    const [link] = await db
      .select()
      .from(distributorProviders)
      .where(
        and(
          eq(distributorProviders.distributorId, userTenantId),
          eq(distributorProviders.providerId, targetTenantId)
        )
      )
    
    if (link) {
      return true
    }
  }

  // Legacy: Check if targetTenant is a direct child (for backward compatibility)
  if (targetTenant.parentTenantId === userTenantId) {
    return true
  }

  // Legacy: Recursively check parent chain (for backward compatibility)
  if (targetTenant.parentTenantId) {
    return canAccessTenant(auth, userTenantId, targetTenant.parentTenantId)
  }

  return false
}

/**
 * Check if an organization is under a tenant (directly or via hierarchy)
 */
export const isOrgUnderTenant = async (
  organizationId: string,
  tenantId: string
): Promise<boolean> => {
  const db = getDb()
  const [org] = await db
    .select({ tenantId: organizations.tenantId })
    .from(organizations)
    .where(eq(organizations.id, organizationId))

  if (!org?.tenantId) {
    return false
  }

  // Direct relationship
  if (org.tenantId === tenantId) {
    return true
  }

  // Check tenant hierarchy
  return canAccessTenant(
    { user: { isSuperAdmin: false }, tenantRoles: {}, tenantIncludeChildren: {} } as any,
    tenantId,
    org.tenantId
  )
}

export const canAccessOrganization = async (
  auth: Awaited<ReturnType<typeof ensureAuthState>>,
  organizationId: string
): Promise<boolean> => {
  if (!auth || auth.user.isSuperAdmin) {
    return true
  }

  // Check if user has direct organization membership
  if (auth.orgRoles[organizationId]) {
    return true
  }

  // Check if user can access organization via tenant hierarchy
  const db = getDb()
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))

  if (!org || !org.tenantId) {
    return false
  }

  // Check if user has access to the organization's tenant
  for (const tenantId of Object.keys(auth.tenantRoles)) {
    const includeChildren = auth.tenantIncludeChildren?.[tenantId] ?? false
    if (!includeChildren) {
      // Without includeChildren, can only access direct tenant
      if (tenantId === org.tenantId) {
        return true
      }
      continue
    }

    // With includeChildren, check hierarchy
    if (await canAccessTenant(auth, tenantId, org.tenantId)) {
      return true
    }
  }

  return false
}

