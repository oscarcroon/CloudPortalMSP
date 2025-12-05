import { createId } from '@paralleldrive/cuid2'
import { eq, and } from 'drizzle-orm'
import { getDb } from './db'
import {
  tenantModulePolicies,
  organizationModulePolicies,
  organizations,
  tenants,
  distributorProviders
} from '../database/schema'
import type { ModuleId, ModuleRoleKey } from '~/constants/modules'
import type { RbacPermission } from '~/constants/rbac'
import { getModulePermissions } from '~/constants/modules'
import { getModuleById } from '~/lib/modules'

/**
 * Module policy permission overrides structure
 * Maps permission names to boolean values (true = allowed, false = denied)
 */
export interface ModulePermissionOverrides {
  [permission: string]: boolean
}

/**
 * Effective module policy for an organization
 * Combines tenant-level and organization-level policies
 */
export type ModuleRoleSource = 'module-default' | 'distributor' | 'provider' | 'organization' | null

export interface EffectiveModulePolicy {
  enabled: boolean
  disabled: boolean
  permissionOverrides: ModulePermissionOverrides
  allowedRoles: ModuleRoleKey[] | null
  allowedRolesSource: ModuleRoleSource
}

const parseAllowedRoles = (raw?: string | null): ModuleRoleKey[] | null => {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return null
    }

    const deduped = Array.from(
      new Set(parsed.filter((role): role is string => typeof role === 'string'))
    )
    return deduped.length === 0 ? [] : (deduped as ModuleRoleKey[])
  } catch {
    return null
  }
}

const normalizeDefaultAllowedRoles = (
  roles?: ModuleRoleKey[] | null
): ModuleRoleKey[] | null => {
  if (roles === undefined || roles === null) {
    return null
  }

  if (roles.length === 0) {
    return []
  }

  return Array.from(new Set(roles)) as ModuleRoleKey[]
}

const mergeAllowedRoles = (
  inherited: ModuleRoleKey[] | null | undefined,
  current: ModuleRoleKey[] | null | undefined
): ModuleRoleKey[] | null => {
  // Once blocked upstream, it stays blocked
  if (Array.isArray(inherited) && inherited.length === 0) {
    return []
  }

  if (current === undefined || current === null) {
    return inherited ?? null
  }

  if (current.length === 0) {
    return []
  }

  const deduped = Array.from(new Set(current)) as ModuleRoleKey[]

  if (!inherited || inherited === null) {
    return deduped
  }

  const allowedSet = new Set(inherited)
  const filtered = deduped.filter(role => allowedSet.has(role))
  return filtered
}

/**
 * Get tenant module policy
 * Returns null if no policy exists (meaning default enabled)
 */
export const getTenantModulePolicy = async (
  tenantId: string,
  moduleId: ModuleId
): Promise<EffectiveModulePolicy | null> => {
  const db = getDb()
  const [policy] = await db
    .select()
    .from(tenantModulePolicies)
    .where(and(eq(tenantModulePolicies.tenantId, tenantId), eq(tenantModulePolicies.moduleId, moduleId)))

  if (!policy) {
    // No policy = default enabled
    return null
  }

  const overrides: ModulePermissionOverrides = policy.permissionOverrides
    ? JSON.parse(policy.permissionOverrides)
    : {}

  // Handle both boolean and integer modes
  const enabledValue = typeof policy.enabled === 'boolean' 
    ? policy.enabled 
    : policy.enabled === 1
  
  const disabledValue = typeof policy.disabled === 'boolean'
    ? policy.disabled
    : policy.disabled === 1

  return {
    enabled: enabledValue,
    disabled: disabledValue,
    permissionOverrides: overrides,
    allowedRoles: parseAllowedRoles(policy.allowedRoles),
    allowedRolesSource: null
  }
}

/**
 * Get organization module policy
 */
export const getOrganizationModulePolicy = async (
  organizationId: string,
  moduleId: ModuleId
): Promise<EffectiveModulePolicy | null> => {
  const db = getDb()
  const [policy] = await db
    .select()
    .from(organizationModulePolicies)
    .where(
      and(
        eq(organizationModulePolicies.organizationId, organizationId),
        eq(organizationModulePolicies.moduleId, moduleId)
      )
    )

  if (!policy) {
    return null
  }

  const overrides: ModulePermissionOverrides = policy.permissionOverrides
    ? JSON.parse(policy.permissionOverrides)
    : {}

  // Handle both boolean and integer modes
  const enabledValue = typeof policy.enabled === 'boolean' 
    ? policy.enabled 
    : policy.enabled === 1
  
  const disabledValue = typeof policy.disabled === 'boolean'
    ? policy.disabled
    : policy.disabled === 1

  return {
    enabled: enabledValue,
    disabled: disabledValue,
    permissionOverrides: overrides,
    allowedRoles: parseAllowedRoles(policy.allowedRoles),
    allowedRolesSource: policy.allowedRoles ? 'organization' : null
  }
}

/**
 * Get effective module policy for an organization
 * This combines tenant-level (distributor/provider) and organization-level policies
 * with inheritance rules:
 * - Distributor sets baseline
 * - Provider can only restrict (not expand)
 * - Organization can only restrict (not expand)
 */
export const getEffectiveModulePolicyForOrg = async (
  organizationId: string,
  moduleId: ModuleId
): Promise<EffectiveModulePolicy> => {
  const db = getDb()

  // Get organization and its tenant
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId))

  if (!org || !org.tenantId) {
    // No tenant = default enabled
    return {
      enabled: true,
      disabled: false,
      permissionOverrides: {},
      allowedRoles: null,
      allowedRolesSource: null
    }
  }

  // Get organization's tenant
  const [orgTenant] = await db.select().from(tenants).where(eq(tenants.id, org.tenantId))

  if (!orgTenant) {
    return {
      enabled: true,
      disabled: false,
      permissionOverrides: {},
      allowedRoles: null,
      allowedRolesSource: null
    }
  }

  // Start with distributor-level policy (if tenant is a provider, check its distributor)
  let distributorPolicy: EffectiveModulePolicy | null = null
  let providerPolicy: EffectiveModulePolicy | null = null

  if (orgTenant.type === 'provider') {
    // Find the distributor linked to this provider
    const [link] = await db
      .select()
      .from(distributorProviders)
      .where(eq(distributorProviders.providerId, orgTenant.id))

    if (link) {
      distributorPolicy = await getTenantModulePolicy(link.distributorId, moduleId)
    }
  } else if (orgTenant.type === 'distributor') {
    distributorPolicy = await getTenantModulePolicy(orgTenant.id, moduleId)
  }

  // Get provider-level policy (if tenant is a provider)
  if (orgTenant.type === 'provider') {
    providerPolicy = await getTenantModulePolicy(orgTenant.id, moduleId)
  }

  // Get organization-level policy
  const orgPolicy = await getOrganizationModulePolicy(organizationId, moduleId)

  // Combine policies with inheritance rules
  // Enabled: must be enabled at all levels
  // If no policy exists (null), default is enabled (true)
  const distributorEnabled = distributorPolicy === null ? true : distributorPolicy.enabled
  // Provider can only restrict, not expand
  const providerEnabled = providerPolicy === null 
    ? distributorEnabled 
    : (distributorEnabled && providerPolicy.enabled)
  // Organization can only restrict, not expand
  const orgEnabled = orgPolicy === null 
    ? true 
    : (providerEnabled && orgPolicy.enabled)
  
  const enabled = distributorEnabled && providerEnabled && orgEnabled

  // Disabled: if any level has disabled=true, module is disabled (grayed out)
  // If no policy exists (null), default is disabled=false
  const distributorDisabled = distributorPolicy === null ? false : distributorPolicy.disabled
  const providerDisabled = providerPolicy === null ? distributorDisabled : (distributorDisabled || providerPolicy.disabled)
  const orgDisabled = orgPolicy === null ? providerDisabled : (providerDisabled || orgPolicy.disabled)
  
  const disabled = distributorDisabled || providerDisabled || orgDisabled

  // Permission overrides: merge with most restrictive wins
  const combinedOverrides: ModulePermissionOverrides = {}

  // Start with distributor overrides
  if (distributorPolicy?.permissionOverrides) {
    Object.assign(combinedOverrides, distributorPolicy.permissionOverrides)
  }

  // Apply provider overrides (can only restrict)
  if (providerPolicy?.permissionOverrides) {
    for (const [permission, value] of Object.entries(providerPolicy.permissionOverrides)) {
      // Provider can only set to false
      if (value === false) {
        combinedOverrides[permission] = false
      }
    }
  }

  // Apply organization overrides (can only restrict)
  if (orgPolicy?.permissionOverrides) {
    for (const [permission, value] of Object.entries(orgPolicy.permissionOverrides)) {
      // Organization can only set to false
      if (value === false) {
        combinedOverrides[permission] = false
      }
    }
  }

  const moduleDefinition = getModuleById(moduleId)
  let allowedRoles: ModuleRoleKey[] | null = normalizeDefaultAllowedRoles(
    moduleDefinition?.defaultAllowedRoles
  )
  let allowedRolesSource: ModuleRoleSource = allowedRoles !== null ? 'module-default' : null

  if (distributorPolicy && distributorPolicy.allowedRoles !== undefined) {
    allowedRoles = mergeAllowedRoles(allowedRoles, distributorPolicy.allowedRoles)
    if (distributorPolicy.allowedRoles !== null) {
      allowedRolesSource = 'distributor'
    }
  }

  if (providerPolicy && providerPolicy.allowedRoles !== undefined) {
    allowedRoles = mergeAllowedRoles(allowedRoles, providerPolicy.allowedRoles)
    if (providerPolicy.allowedRoles !== null) {
      allowedRolesSource = 'provider'
    }
  }

  if (orgPolicy && orgPolicy.allowedRoles !== undefined) {
    allowedRoles = mergeAllowedRoles(allowedRoles, orgPolicy.allowedRoles)
    if (orgPolicy.allowedRoles !== null) {
      allowedRolesSource = 'organization'
    }
  }

  return {
    enabled,
    disabled,
    permissionOverrides: combinedOverrides,
    allowedRoles,
    allowedRolesSource
  }
}

/**
 * Check if a module is enabled for an organization
 */
export const isModuleEnabledForOrg = async (
  organizationId: string,
  moduleId: ModuleId
): Promise<boolean> => {
  const policy = await getEffectiveModulePolicyForOrg(organizationId, moduleId)
  // Ensure we return a boolean
  return Boolean(policy.enabled)
}

export const getAllowedModuleRolesForOrg = async (
  organizationId: string,
  moduleId: ModuleId
): Promise<ModuleRoleKey[] | null> => {
  const policy = await getEffectiveModulePolicyForOrg(organizationId, moduleId)
  return policy.allowedRoles
}

/**
 * Check if a specific permission is allowed for a module in an organization
 * This checks both the module policy and the permission override
 */
export const isModulePermissionAllowed = async (
  organizationId: string,
  moduleId: ModuleId,
  permission: RbacPermission
): Promise<boolean> => {
  // First check if module is enabled
  const enabled = await isModuleEnabledForOrg(organizationId, moduleId)
  if (!enabled) {
    return false
  }

  // Get effective policy
  const policy = await getEffectiveModulePolicyForOrg(organizationId, moduleId)

  // Check if permission is explicitly overridden
  if (policy.permissionOverrides[permission] === false) {
    return false
  }

  // Check if permission belongs to this module
  const modulePermissions = getModulePermissions(moduleId)
  if (!modulePermissions.includes(permission)) {
    // Permission doesn't belong to this module, so module policy doesn't apply
    return true
  }

  // If no override exists, permission is allowed (assuming user has RBAC permission)
  return true
}

/**
 * Set or update tenant module policy
 * If enabled is true and there are no permission overrides, we can delete the policy
 * to return to default state
 */
export const setTenantModulePolicy = async (
  tenantId: string,
  moduleId: ModuleId,
  enabled: boolean,
  permissionOverrides?: ModulePermissionOverrides,
  disabled?: boolean,
  allowedRoles?: ModuleRoleKey[] | null
): Promise<void> => {
  const db = getDb()

  // Try to find existing policy
  const [existing] = await db
    .select()
    .from(tenantModulePolicies)
    .where(and(eq(tenantModulePolicies.tenantId, tenantId), eq(tenantModulePolicies.moduleId, moduleId)))

  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  // Convert permissionOverrides to JSON
  // If permissionOverrides is explicitly provided (even if empty), save it
  // If undefined, it means "don't change overrides", so use existing or null
  let overridesJson: string | null = null
  if (permissionOverrides !== undefined) {
    // Explicitly provided - save it even if empty (empty object means no overrides)
    overridesJson = Object.keys(permissionOverrides).length > 0 
      ? JSON.stringify(permissionOverrides)
      : '{}'
  } else if (existing && existing.permissionOverrides) {
    // Not provided, but existing policy has overrides - keep them
    overridesJson = existing.permissionOverrides
  }

  // Handle disabled parameter - if undefined, keep existing value or default to false
  let finalDisabled = disabled
  if (disabled === undefined && existing) {
    const disabledValue = typeof existing.disabled === 'boolean' 
      ? existing.disabled 
      : existing.disabled === 1
    finalDisabled = disabledValue
  } else if (disabled === undefined) {
    finalDisabled = false
  }

  let allowedRolesJson: string | null | undefined
  if (allowedRoles !== undefined) {
    if (allowedRoles === null) {
      allowedRolesJson = null
    } else {
      const dedupedRoles = Array.from(new Set(allowedRoles)) as ModuleRoleKey[]
      allowedRolesJson = JSON.stringify(dedupedRoles)
    }
  } else if (existing) {
    allowedRolesJson = existing.allowedRoles ?? null
  }

  if (allowedRolesJson === undefined) {
    allowedRolesJson = null
  }

  // Always create/update policy when enabled is explicitly set
  // This ensures the UI can properly track module state
  // We never skip creating/updating the policy - it's needed to track explicit state changes
  if (existing) {
    // Update existing policy
    if (isSqlite) {
      db.update(tenantModulePolicies)
        .set({
          enabled: enabled ? 1 : 0,
          disabled: finalDisabled ? 1 : 0,
          permissionOverrides: overridesJson,
          allowedRoles: allowedRolesJson,
          updatedAt: new Date()
        })
        .where(eq(tenantModulePolicies.id, existing.id))
        .run()
    } else {
      await db
        .update(tenantModulePolicies)
        .set({
          enabled: enabled ? 1 : 0,
          disabled: finalDisabled ? 1 : 0,
          permissionOverrides: overridesJson,
          allowedRoles: allowedRolesJson,
          updatedAt: new Date()
        })
        .where(eq(tenantModulePolicies.id, existing.id))
    }
  } else {
    // Create new policy
    if (isSqlite) {
      db.insert(tenantModulePolicies).values({
        id: createId(),
        tenantId,
        moduleId,
        enabled: enabled ? 1 : 0,
        disabled: finalDisabled ? 1 : 0,
        permissionOverrides: overridesJson,
        allowedRoles: allowedRolesJson
      }).run()
    } else {
      await db.insert(tenantModulePolicies).values({
        id: createId(),
        tenantId,
        moduleId,
        enabled: enabled ? 1 : 0,
        disabled: finalDisabled ? 1 : 0,
        permissionOverrides: overridesJson,
        allowedRoles: allowedRolesJson
      })
    }
  }
}

/**
 * Set or update organization module policy
 */
export const setOrganizationModulePolicy = async (
  organizationId: string,
  moduleId: ModuleId,
  enabled: boolean,
  permissionOverrides?: ModulePermissionOverrides,
  disabled?: boolean,
  allowedRoles?: ModuleRoleKey[] | null
): Promise<void> => {
  const db = getDb()

  const overridesJson =
    permissionOverrides && Object.keys(permissionOverrides).length > 0
      ? JSON.stringify(permissionOverrides)
      : permissionOverrides
      ? '{}'
      : null

  // Try to update existing policy
  const [existing] = await db
    .select()
    .from(organizationModulePolicies)
    .where(
      and(
        eq(organizationModulePolicies.organizationId, organizationId),
        eq(organizationModulePolicies.moduleId, moduleId)
      )
    )

  // Handle disabled parameter - if undefined, keep existing value or default to false
  let finalDisabled = disabled
  if (disabled === undefined && existing) {
    const disabledValue = typeof existing.disabled === 'boolean' 
      ? existing.disabled 
      : existing.disabled === 1
    finalDisabled = disabledValue
  } else if (disabled === undefined) {
    finalDisabled = false
  }

  let allowedRolesJson: string | null | undefined
  if (allowedRoles !== undefined) {
    if (allowedRoles === null) {
      allowedRolesJson = null
    } else {
      const dedupedRoles = Array.from(new Set(allowedRoles)) as ModuleRoleKey[]
      allowedRolesJson = JSON.stringify(dedupedRoles)
    }
  } else if (existing) {
    allowedRolesJson = existing.allowedRoles ?? null
  }

  if (allowedRolesJson === undefined) {
    allowedRolesJson = null
  }

  if (existing) {
    await db
      .update(organizationModulePolicies)
      .set({
        enabled: enabled ? 1 : 0,
        disabled: finalDisabled ? 1 : 0,
        permissionOverrides: overridesJson,
        allowedRoles: allowedRolesJson,
        updatedAt: new Date()
      })
      .where(eq(organizationModulePolicies.id, existing.id))
  } else {
    // Create new policy
    await db.insert(organizationModulePolicies).values({
      id: createId(),
      organizationId,
      moduleId,
      enabled: enabled ? 1 : 0,
      disabled: finalDisabled ? 1 : 0,
      permissionOverrides: overridesJson,
      allowedRoles: allowedRolesJson
    })
  }
}

