import { createError, H3Event } from 'h3'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { ensureAuthState } from './session'
import { getDb } from './db'
import {
  tenants,
  tenantMemberships,
  modulePermissions,
  distributorProviders,
  tenantModulePolicies,
  modules
} from '../database/schema'
import { createHash } from 'crypto'
import type { RbacPermission } from '~/constants/rbac'
import { hasTenantPermission } from './rbac'

export type AuthState = NonNullable<Awaited<ReturnType<typeof ensureAuthState>>>

export interface PermissionEntry {
  moduleKey: string
  permissionKey: string
}

export interface ValidatedPermission extends PermissionEntry {
  isActive: boolean
  status: 'active' | 'deprecated' | 'removed'
  description?: string | null
}

export interface ValidationResult {
  valid: ValidatedPermission[]
  invalid: Array<PermissionEntry & { reason: string }>
}

export interface FilterResult {
  available: PermissionEntry[]
  unavailable: Array<PermissionEntry & { reason: string }>
}

/**
 * Helper to verify distributor-admin access for template management
 * Returns auth state if user is superadmin OR distributor-tenant member with admin role
 */
export async function requireDistributorTemplateAccess(
  event: H3Event,
  distributorId: string
): Promise<AuthState> {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()

  // Verify tenant exists and is a distributor
  const [tenant] = await db
    .select({ id: tenants.id, type: tenants.type, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, distributorId))
    .limit(1)

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Distributor not found' })
  }

  if (tenant.type !== 'distributor') {
    throw createError({
      statusCode: 400,
      message: 'Tenant is not a distributor'
    })
  }

  // Superadmin has access to everything
  if (auth.user.isSuperAdmin) {
    return auth
  }

  // Check if user is a member of this distributor tenant with admin permission
  const tenantRole = auth.tenantRoles[distributorId]
  if (tenantRole && hasTenantPermission(tenantRole, 'tenants:manage-members')) {
    return auth
  }

  throw createError({
    statusCode: 403,
    message: 'Missing permission to manage templates for this distributor'
  })
}

/**
 * Validate permissions against the module_permissions registry
 * Returns valid and invalid permissions with reasons
 */
export async function validatePermissionsAgainstRegistry(
  permissions: PermissionEntry[],
  options: { requireActive?: boolean } = {}
): Promise<ValidationResult> {
  const { requireActive = true } = options

  if (permissions.length === 0) {
    return { valid: [], invalid: [] }
  }

  const db = getDb()

  // Build conditions for lookup
  const permissionPairs = permissions.map(
    (p) => `${p.moduleKey}:${p.permissionKey}`
  )

  // Fetch all matching permissions from registry
  const registryPerms = await db
    .select({
      moduleKey: modulePermissions.moduleKey,
      permissionKey: modulePermissions.permissionKey,
      isActive: modulePermissions.isActive,
      status: modulePermissions.status,
      description: modulePermissions.description
    })
    .from(modulePermissions)

  // Create lookup map
  const registryMap = new Map<string, (typeof registryPerms)[0]>()
  for (const perm of registryPerms) {
    const key = `${perm.moduleKey}:${perm.permissionKey}`
    registryMap.set(key, perm)
  }

  const valid: ValidatedPermission[] = []
  const invalid: ValidationResult['invalid'] = []

  for (const perm of permissions) {
    const key = `${perm.moduleKey}:${perm.permissionKey}`
    const registryPerm = registryMap.get(key)

    if (!registryPerm) {
      invalid.push({ ...perm, reason: 'Permission not found in registry' })
      continue
    }

    if (requireActive) {
      if (!registryPerm.isActive) {
        invalid.push({ ...perm, reason: 'Permission is not active' })
        continue
      }

      if (registryPerm.status === 'removed') {
        invalid.push({ ...perm, reason: 'Permission has been removed' })
        continue
      }
    }

    valid.push({
      moduleKey: perm.moduleKey,
      permissionKey: perm.permissionKey,
      isActive: registryPerm.isActive,
      status: registryPerm.status as 'active' | 'deprecated' | 'removed',
      description: registryPerm.description
    })
  }

  return { valid, invalid }
}

/**
 * Filter permissions based on provider's module access
 * Checks tenant module policies and module availability
 */
export async function filterPermissionsByProviderAccess(
  providerId: string,
  permissions: PermissionEntry[]
): Promise<FilterResult> {
  if (permissions.length === 0) {
    return { available: [], unavailable: [] }
  }

  const db = getDb()

  // Get unique module keys from permissions
  const moduleKeys = [...new Set(permissions.map((p) => p.moduleKey))]

  // Fetch provider's tenant module policies
  const policies = await db
    .select({
      moduleKey: tenantModulePolicies.moduleId,
      mode: tenantModulePolicies.mode
    })
    .from(tenantModulePolicies)
    .where(eq(tenantModulePolicies.tenantId, providerId))

  const policyMap = new Map<string, string>()
  for (const policy of policies) {
    policyMap.set(policy.moduleKey, policy.mode)
  }

  // Fetch global module availability
  const moduleRecords = await db
    .select({
      key: modules.key,
      enabled: modules.enabled,
      disabled: modules.disabled
    })
    .from(modules)
    .where(inArray(modules.key, moduleKeys))

  const moduleAvailability = new Map<string, boolean>()
  for (const mod of moduleRecords) {
    // A module is available if enabled globally and not disabled
    moduleAvailability.set(mod.key, mod.enabled && !mod.disabled)
  }

  const available: PermissionEntry[] = []
  const unavailable: FilterResult['unavailable'] = []

  for (const perm of permissions) {
    // Check if module is globally available
    const isModuleAvailable = moduleAvailability.get(perm.moduleKey)
    if (isModuleAvailable === false) {
      unavailable.push({
        ...perm,
        reason: `Module '${perm.moduleKey}' is not available`
      })
      continue
    }

    // Check tenant policy (if exists)
    const policy = policyMap.get(perm.moduleKey)
    if (policy === 'disabled') {
      unavailable.push({
        ...perm,
        reason: `Module '${perm.moduleKey}' is disabled for this provider`
      })
      continue
    }

    available.push(perm)
  }

  return { available, unavailable }
}

/**
 * Calculate a fingerprint hash of a sorted permission list
 * Used for detecting local modifications since last sync
 */
export function calculatePermissionsFingerprint(
  permissions: PermissionEntry[]
): string {
  // Sort by moduleKey, then permissionKey for consistent hashing
  const sorted = [...permissions].sort((a, b) => {
    const moduleCompare = a.moduleKey.localeCompare(b.moduleKey)
    if (moduleCompare !== 0) return moduleCompare
    return a.permissionKey.localeCompare(b.permissionKey)
  })

  const permString = sorted
    .map((p) => `${p.moduleKey}:${p.permissionKey}`)
    .join('|')

  return createHash('sha256').update(permString).digest('hex').substring(0, 16)
}

/**
 * Verify that a provider is linked to a distributor
 */
export async function verifyProviderDistributorLink(
  providerId: string,
  distributorId: string
): Promise<boolean> {
  const db = getDb()

  const [link] = await db
    .select({ id: distributorProviders.id })
    .from(distributorProviders)
    .where(
      and(
        eq(distributorProviders.providerId, providerId),
        eq(distributorProviders.distributorId, distributorId)
      )
    )
    .limit(1)

  return !!link
}

/**
 * Get all distributor IDs linked to a provider
 */
export async function getLinkedDistributors(providerId: string): Promise<string[]> {
  const db = getDb()

  const links = await db
    .select({ distributorId: distributorProviders.distributorId })
    .from(distributorProviders)
    .where(eq(distributorProviders.providerId, providerId))

  return links.map((l) => l.distributorId)
}

/**
 * Generate a unique key with suffix if needed
 */
export function generateUniqueKey(baseKey: string, existingKeys: string[]): string {
  if (!existingKeys.includes(baseKey)) {
    return baseKey
  }

  let suffix = 2
  let candidateKey = `${baseKey}-${suffix}`
  while (existingKeys.includes(candidateKey)) {
    suffix++
    candidateKey = `${baseKey}-${suffix}`
  }

  return candidateKey
}

/**
 * Compute diff between two permission sets
 */
export function computePermissionsDiff(
  currentPerms: PermissionEntry[],
  targetPerms: PermissionEntry[],
  strategy: 'merge' | 'replace'
): {
  toAdd: PermissionEntry[]
  toRemove: PermissionEntry[]
  unchanged: PermissionEntry[]
} {
  const currentSet = new Set(
    currentPerms.map((p) => `${p.moduleKey}:${p.permissionKey}`)
  )
  const targetSet = new Set(
    targetPerms.map((p) => `${p.moduleKey}:${p.permissionKey}`)
  )

  const toAdd: PermissionEntry[] = []
  const toRemove: PermissionEntry[] = []
  const unchanged: PermissionEntry[] = []

  // Permissions to add (in target but not in current)
  for (const perm of targetPerms) {
    const key = `${perm.moduleKey}:${perm.permissionKey}`
    if (!currentSet.has(key)) {
      toAdd.push(perm)
    } else {
      unchanged.push(perm)
    }
  }

  // Permissions to remove depends on strategy
  if (strategy === 'replace') {
    // Remove anything not in target
    for (const perm of currentPerms) {
      const key = `${perm.moduleKey}:${perm.permissionKey}`
      if (!targetSet.has(key)) {
        toRemove.push(perm)
      }
    }
  }
  // For 'merge' strategy, we don't remove anything

  return { toAdd, toRemove, unchanged }
}
