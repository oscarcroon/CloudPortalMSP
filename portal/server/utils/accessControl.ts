/**
 * Access control utilities for module-level authorization.
 * 
 * Provides a unified gate that checks both:
 * 1. Module policy (is the module enabled/not blocked for this org?)
 * 2. User permissions (does the user have the required permission?)
 */

import { createError, H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { ensureAuthState } from './session'
import { getDb } from './db'
import { organizations } from '../database/schema'
import { getEffectiveModulePolicyForOrg } from './modulePolicy'
import { resolveEffectiveModulePermissions } from './modulePermissions'
import type { ModuleId } from '~/constants/modules'

export interface ModuleAccessResult {
  auth: Awaited<ReturnType<typeof ensureAuthState>>
  orgId: string
  moduleKey: ModuleId
  policy: Awaited<ReturnType<typeof getEffectiveModulePolicyForOrg>>
  permissions: Awaited<ReturnType<typeof resolveEffectiveModulePermissions>>
}

/**
 * Require module access for an API route.
 * 
 * This is the unified gate that should be used by all module-related API endpoints.
 * It checks:
 * 1. User is authenticated
 * 2. Organization exists and is active
 * 3. Module is not blocked for the organization (policy check)
 * 4. User has the required permission for this module (permission check)
 * 
 * Superadmins bypass permission checks.
 * 
 * @param event - H3 event
 * @param moduleKey - The module key (e.g., 'windows-dns')
 * @param requiredPermission - The permission key required (e.g., 'windows-dns:view')
 * @param orgId - Optional org ID (uses currentOrgId from auth if not provided)
 * 
 * @throws 401 if not authenticated
 * @throws 400 if no organization selected
 * @throws 404 if organization not found
 * @throws 403 if organization is inactive, module is blocked, or permission is missing
 */
export async function requireModuleAccess(
  event: H3Event,
  params: {
    moduleKey: ModuleId
    requiredPermission: string
    orgId?: string
  }
): Promise<ModuleAccessResult> {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const orgId = params.orgId ?? auth.currentOrgId
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'No organization selected' })
  }

  // Superadmins bypass all checks
  if (auth.user.isSuperAdmin) {
    const policy = await getEffectiveModulePolicyForOrg(orgId, params.moduleKey)
    const permissions = await resolveEffectiveModulePermissions({
      orgId,
      moduleKey: params.moduleKey,
      userId: auth.user.id
    })
    return { auth, orgId, moduleKey: params.moduleKey, policy, permissions }
  }

  const db = getDb()

  // Check organization exists and is active
  const [org] = await db
    .select({ status: organizations.status, setupStatus: organizations.setupStatus })
    .from(organizations)
    .where(eq(organizations.id, orgId))

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  if (org.status !== 'active') {
    throw createError({ statusCode: 403, message: 'Organization is inactive' })
  }

  // Check module policy (is module enabled for this org?)
  const policy = await getEffectiveModulePolicyForOrg(orgId, params.moduleKey)

  if (policy.mode === 'blocked') {
    throw createError({
      statusCode: 403,
      message: `Module ${params.moduleKey} is blocked for this organization`
    })
  }

  // Check user has required permission
  const permissions = await resolveEffectiveModulePermissions({
    orgId,
    moduleKey: params.moduleKey,
    userId: auth.user.id
  })

  if (!permissions.effectivePermissions.has(params.requiredPermission)) {
    throw createError({
      statusCode: 403,
      message: `Missing permission: ${params.requiredPermission}`
    })
  }

  return {
    auth,
    orgId,
    moduleKey: params.moduleKey,
    policy,
    permissions
  }
}

/**
 * Check if module is accessible (non-throwing version).
 * 
 * Returns true if the module is accessible, false otherwise.
 * Useful for conditional logic where you don't want to throw.
 */
export async function canAccessModule(
  event: H3Event,
  params: {
    moduleKey: ModuleId
    requiredPermission: string
    orgId?: string
  }
): Promise<boolean> {
  try {
    await requireModuleAccess(event, params)
    return true
  } catch {
    return false
  }
}

/**
 * Check if user has any of the specified permissions for a module.
 * 
 * Useful when multiple permissions can grant access (e.g., read OR manage).
 */
export async function requireModuleAccessAny(
  event: H3Event,
  params: {
    moduleKey: ModuleId
    requiredPermissions: string[]
    orgId?: string
  }
): Promise<ModuleAccessResult & { matchedPermission: string }> {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const orgId = params.orgId ?? auth.currentOrgId
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'No organization selected' })
  }

  // Superadmins bypass all checks
  if (auth.user.isSuperAdmin) {
    const policy = await getEffectiveModulePolicyForOrg(orgId, params.moduleKey)
    const permissions = await resolveEffectiveModulePermissions({
      orgId,
      moduleKey: params.moduleKey,
      userId: auth.user.id
    })
    return {
      auth,
      orgId,
      moduleKey: params.moduleKey,
      policy,
      permissions,
      matchedPermission: params.requiredPermissions[0]
    }
  }

  const db = getDb()

  // Check organization exists and is active
  const [org] = await db
    .select({ status: organizations.status })
    .from(organizations)
    .where(eq(organizations.id, orgId))

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  if (org.status !== 'active') {
    throw createError({ statusCode: 403, message: 'Organization is inactive' })
  }

  // Check module policy
  const policy = await getEffectiveModulePolicyForOrg(orgId, params.moduleKey)

  if (policy.mode === 'blocked') {
    throw createError({
      statusCode: 403,
      message: `Module ${params.moduleKey} is blocked for this organization`
    })
  }

  // Check user has any of the required permissions
  const permissions = await resolveEffectiveModulePermissions({
    orgId,
    moduleKey: params.moduleKey,
    userId: auth.user.id
  })

  const matchedPermission = params.requiredPermissions.find(p =>
    permissions.effectivePermissions.has(p)
  )

  if (!matchedPermission) {
    throw createError({
      statusCode: 403,
      message: `Missing permission: one of ${params.requiredPermissions.join(', ')}`
    })
  }

  return {
    auth,
    orgId,
    moduleKey: params.moduleKey,
    policy,
    permissions,
    matchedPermission
  }
}
