import { createError, H3Event } from 'h3'
import type { RbacPermission, RbacRole, TenantRole } from '~/constants/rbac'
import { rolePermissionMap, tenantRolePermissionMap } from '~/constants/rbac'
import { ensureAuthState } from './session'
import { getDb } from './db'
import { eq, or, and } from 'drizzle-orm'
import { organizations, tenants } from '../database/schema'

export const hasPermission = (role: RbacRole, permission: RbacPermission) =>
  rolePermissionMap[role]?.includes(permission) ?? false

export const hasTenantPermission = (role: TenantRole, permission: RbacPermission) =>
  tenantRolePermissionMap[role]?.includes(permission) ?? false

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

  // Check if user has direct organization permission
  const role = auth.orgRoles[orgId]
  if (role && hasPermission(role, permission)) {
    return { auth, role, orgId }
  }

  // Check if user can access organization via tenant hierarchy
  const hasAccess = await canAccessOrganization(auth, orgId)
  if (hasAccess) {
    // Check tenant permissions for tenant-level permissions
    if (permission.startsWith('tenants:') || permission.startsWith('org:manage')) {
      // For tenant-level permissions, check tenant roles
      const [org] = await getDb()
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))

      if (org?.tenantId) {
        for (const [tenantId, tenantRole] of Object.entries(auth.tenantRoles)) {
          if (
            (await canAccessTenant(auth, tenantId, org.tenantId)) &&
            hasTenantPermission(tenantRole, permission)
          ) {
            return { auth, role: 'owner', orgId }
          }
        }
      }
    } else {
      // For organization-level permissions accessed via tenant, grant owner-level access
      return { auth, role: 'owner', orgId }
    }
  }

  throw createError({
    statusCode: 403,
    message: `Missing permission ${permission} for organization ${orgId}`
  })
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

  // Check if targetTenantId is a descendant of userTenantId
  const db = getDb()
  const [targetTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, targetTenantId))

  if (!targetTenant) {
    return false
  }

  // Check if user has includeChildren enabled for this tenant
  const includeChildren = auth.tenantIncludeChildren?.[userTenantId] ?? false
  
  // If includeChildren is false, user can only access their own tenant
  if (!includeChildren) {
    return false
  }

  // Check if targetTenant is a direct child
  if (targetTenant.parentTenantId === userTenantId) {
    return true
  }

  // Recursively check parent chain to see if targetTenant is a descendant
  if (targetTenant.parentTenantId) {
    return canAccessTenant(auth, userTenantId, targetTenant.parentTenantId)
  }

  return false
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
    if (await canAccessTenant(auth, tenantId, org.tenantId)) {
      return true
    }
  }

  return false
}

