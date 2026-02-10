import { and, eq, isNull, or, gt, inArray } from 'drizzle-orm'
import { createError, H3Event } from 'h3'
import { manifests } from '~~/layers/plugin-manifests'
import {
  userModulePermissions,
  organizationMemberships,
  mspOrgDelegations,
  mspOrgDelegationPermissions,
  orgGroupModulePermissions,
  orgGroupMembers,
  organizations,
  tenantMemberships,
  tenantMemberRoles,
  tenantMemberMspRoles,
  mspRolePermissions,
  modulePermissions as modulePermissionsTable
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { ensureAuthState } from './session'
import type { ModuleId } from '~/constants/modules'
import type { RbacRole, TenantRole } from '~/constants/rbac'
import type { ModulePolicy } from '~/types/modules'
import { getModulePermissionsForMspRoles } from './mspRolePermissionBundles'
import { canAccessTenant } from './rbac'
import { getEffectiveModulePolicyForOrg } from './modulePolicy'
import { normalizePermissionOverrides } from './userModulePermissions'

type PermissionKey = string

export interface EffectiveModulePermissions {
  allowedPermissions: Set<PermissionKey>
  baselinePermissions: Set<PermissionKey>
  groupGrants: Map<string, Set<PermissionKey>> // groupId -> perms
  groupDenies: Map<string, Set<PermissionKey>>
  userGrants: Set<PermissionKey>
  userDenies: Set<PermissionKey>
  delegatedGrants?: Set<PermissionKey>
  effectivePermissions: Set<PermissionKey>
  policy: ModulePolicy & { enabled: boolean; disabled: boolean }
}

const getModuleManifest = (moduleKey: string) =>
  manifests.find((m) => m.module.key === moduleKey)

/**
 * Get MSP role permissions from database for a tenant membership
 * Returns permissions for the specified module, filtered by active status
 */
async function getMspRolePermissionsFromDb(
  membershipId: string,
  moduleKey: string,
  tenantId: string
): Promise<Set<string>> {
  const db = getDb()

  // Get MSP roles assigned to this membership
  const assignedRoles = await db
    .select({ roleId: tenantMemberMspRoles.roleId })
    .from(tenantMemberMspRoles)
    .where(eq(tenantMemberMspRoles.tenantMembershipId, membershipId))

  if (assignedRoles.length === 0) {
    return new Set()
  }

  const roleIds = assignedRoles.map((r) => r.roleId)

  // Batch fetch permissions for these roles, filtered by module and active status
  // Join with module_permissions to ensure permissions are active
  const permissions = await db
    .select({
      permissionKey: mspRolePermissions.permissionKey
    })
    .from(mspRolePermissions)
    .innerJoin(
      modulePermissionsTable,
      and(
        eq(mspRolePermissions.moduleKey, modulePermissionsTable.moduleKey),
        eq(mspRolePermissions.permissionKey, modulePermissionsTable.permissionKey)
      )
    )
    .where(
      and(
        inArray(mspRolePermissions.roleId, roleIds),
        eq(mspRolePermissions.moduleKey, moduleKey),
        eq(modulePermissionsTable.isActive, true),
        eq(modulePermissionsTable.status, 'active')
      )
    )

  return new Set(permissions.map((p) => p.permissionKey))
}

export const getBaselineModulePermissionsForUser = async (
  orgId: string,
  userId: string,
  moduleKey: ModuleId
): Promise<Set<PermissionKey>> => {
  const manifest = getModuleManifest(moduleKey)
  if (!manifest) return new Set()

  const db = getDb()
  const [membership] = await db
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.organizationId, orgId), eq(organizationMemberships.userId, userId)))

  const userRole = membership?.role as RbacRole | undefined
  const rbacDefaults = manifest.rbacDefaults ?? {}
  const list = (userRole ? rbacDefaults[userRole] : undefined) ?? []
  const manifestPermissions = new Set<string>(manifest.permissions.map((p: { key: string }) => p.key))
  const result = new Set<PermissionKey>()
  for (const perm of list) {
    const permKey = String(perm)
    if (permKey.endsWith(':*')) {
      const prefix = permKey.replace('*', '')
      for (const p of manifestPermissions) {
        if (p.startsWith(prefix)) {
          result.add(p)
        }
      }
    } else if (manifestPermissions.has(permKey)) {
      result.add(permKey)
    }
  }
  return result
}

// Policy resolution is now delegated to modulePolicy.ts
// This file only handles user-level permission resolution (baseline, groups, overrides)

export const resolveEffectiveModulePermissions = async ({
  orgId,
  moduleKey,
  userId
}: {
  orgId: string
  moduleKey: ModuleId
  userId: string
}): Promise<EffectiveModulePermissions> => {
  const manifest = getModuleManifest(moduleKey)
  if (!manifest) {
    const blockedPolicy: ModulePolicy & { enabled: boolean; disabled: boolean } = {
      moduleKey,
      mode: 'blocked',
      allowedPermissions: [],
      allowedRoles: [],
      enabled: false,
      disabled: true
    }
    return {
      allowedPermissions: new Set(),
      baselinePermissions: new Set(),
      groupGrants: new Map(),
      groupDenies: new Map(),
      userGrants: new Set(),
      userDenies: new Set(),
      effectivePermissions: new Set(),
      policy: blockedPolicy
    }
  }

  const permissionKeys = manifest.permissions.map((p: { key: string }) => p.key)
  const baseline = await getBaselineModulePermissionsForUser(orgId, userId, moduleKey)

  const db = getDb()

  // Use modulePolicy.ts as single source of truth for policy resolution
  // This properly handles global -> distributor -> tenant -> org cascade
  const effectivePolicy = await getEffectiveModulePolicyForOrg(orgId, moduleKey)

  // Type guard: check if policy is blocked
  if (effectivePolicy.mode === 'blocked') {
    return {
      allowedPermissions: new Set(),
      baselinePermissions: baseline,
      groupGrants: new Map(),
      groupDenies: new Map(),
      userGrants: new Set(),
      userDenies: new Set(),
      effectivePermissions: new Set(),
      policy: effectivePolicy
    }
  }

  // FAIL-CLOSED: If mode is allowlist and allowedPermissions is empty, grant NO permissions
  // This is a security measure to ensure explicit permission grants are required
  const allowed = new Set<string>(
    effectivePolicy.mode === 'allowlist' && (!effectivePolicy.allowedPermissions || effectivePolicy.allowedPermissions.length === 0)
      ? [] // Fail-closed: empty allowlist = no permissions
      : effectivePolicy.allowedPermissions && effectivePolicy.allowedPermissions.length > 0
        ? effectivePolicy.allowedPermissions
        : permissionKeys
  )

  // group grants/denies (tabell saknas i denna miljö): lämna tomt
  const groupGrants = new Map<string, Set<string>>()
  const groupDenies = new Map<string, Set<string>>()

  // Org-group grants/denies (via org_group_module_permissions)
  const groupRows = await db
    .select({
      groupId: orgGroupModulePermissions.groupId,
      permissionKey: orgGroupModulePermissions.permissionKey,
      effect: orgGroupModulePermissions.effect
    })
    .from(orgGroupModulePermissions)
    .innerJoin(orgGroupMembers, eq(orgGroupMembers.groupId, orgGroupModulePermissions.groupId))
    .where(
      and(
        eq(orgGroupModulePermissions.organizationId, orgId),
        eq(orgGroupModulePermissions.moduleKey, moduleKey),
        eq(orgGroupMembers.userId, userId)
      )
    )

  for (const row of groupRows) {
    const targetMap = row.effect === 'deny' ? groupDenies : groupGrants
    if (!targetMap.has(row.groupId)) {
      targetMap.set(row.groupId, new Set<string>())
    }
    targetMap.get(row.groupId)?.add(row.permissionKey)
  }

  // user grants/denies
  const [userPerm] = await db
    .select({
      deniedPermissions: userModulePermissions.deniedPermissions
    })
    .from(userModulePermissions)
    .where(
      and(
        eq(userModulePermissions.organizationId, orgId),
        eq(userModulePermissions.userId, userId),
        eq(userModulePermissions.moduleId, moduleKey)
      )
    )

  const rawOverrides = userPerm?.deniedPermissions && userPerm.deniedPermissions.trim()
    ? JSON.parse(userPerm.deniedPermissions)
    : null

  const normalized = normalizePermissionOverrides(rawOverrides)
  const userGrants = new Set<string>(normalized?.grants ?? [])
  const userDenies = new Set<string>(normalized?.denies ?? [])

  // Delegation grants (MSP → Org) - ad-hoc delegations
  const nowMs = Date.now()
  const delegationRows = await db
    .select({
      revokedAt: mspOrgDelegations.revokedAt,
      expiresAt: mspOrgDelegations.expiresAt,
      permissionKey: mspOrgDelegationPermissions.permissionKey
    })
    .from(mspOrgDelegations)
    .leftJoin(
      mspOrgDelegationPermissions,
      eq(mspOrgDelegations.id, mspOrgDelegationPermissions.delegationId)
    )
    .where(
      and(
        eq(mspOrgDelegations.orgId, orgId),
        eq(mspOrgDelegations.subjectType, 'user'),
        eq(mspOrgDelegations.subjectId, userId)
      )
    )

  const delegatedGrants = new Set<string>()
  for (const row of delegationRows) {
    const revokedAt =
      typeof row.revokedAt === 'number'
        ? row.revokedAt
        : row.revokedAt
          ? new Date(row.revokedAt as any).getTime()
          : null
    const expiresAt =
      typeof row.expiresAt === 'number'
        ? row.expiresAt
        : row.expiresAt
          ? new Date(row.expiresAt as any).getTime()
          : null
    const isRevoked = revokedAt !== null && revokedAt !== undefined
    const isExpired = expiresAt !== null && expiresAt !== undefined && expiresAt <= nowMs
    if (isRevoked || isExpired) continue
    if (row.permissionKey) {
      delegatedGrants.add(row.permissionKey)
    }
  }

  // Tenant-scope + MSP roles grants (ALL scope via includeChildren)
  // Get organization's tenant
  const [orgRecord] = await db
    .select({ tenantId: organizations.tenantId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (orgRecord?.tenantId) {
    // Get all tenant memberships for user (to check hierarchy)
    const allTenantMemberships = await db
      .select({
        id: tenantMemberships.id,
        tenantId: tenantMemberships.tenantId,
        includeChildren: tenantMemberships.includeChildren,
        role: tenantMemberships.role
      })
      .from(tenantMemberships)
      .where(eq(tenantMemberships.userId, userId))

    for (const membership of allTenantMemberships) {
      // Check if this membership can reach the org's tenant
      // Direct match
      if (membership.tenantId === orgRecord.tenantId) {
        // Check if includeChildren is true
        if (membership.includeChildren) {
          // Get DB-based MSP role permissions
          const dbMspPerms = await getMspRolePermissionsFromDb(membership.id, moduleKey, membership.tenantId)
          for (const perm of dbMspPerms) {
            delegatedGrants.add(perm)
          }

          // Also check legacy string-based MSP roles (for backwards compatibility)
          const mspRoles: TenantRole[] = []
          
          // Check primary role
          if (membership.role.startsWith('msp-')) {
            mspRoles.push(membership.role as TenantRole)
          }

          // Get additional roles
          const additionalRoles = await db
            .select({ roleKey: tenantMemberRoles.roleKey })
            .from(tenantMemberRoles)
            .where(eq(tenantMemberRoles.membershipId, membership.id))

          for (const r of additionalRoles) {
            if (r.roleKey.startsWith('msp-')) {
              mspRoles.push(r.roleKey as TenantRole)
            }
          }

          // If user has at least one legacy MSP role, get permission bundles (fallback to hardcoded)
          if (mspRoles.length > 0) {
            const mspPerms = await getModulePermissionsForMspRoles(mspRoles, moduleKey, membership.tenantId)
            for (const perm of mspPerms) {
              delegatedGrants.add(perm)
            }
          }
        }
      } else if (membership.includeChildren) {
        // Check tenant hierarchy (simplified - we'll need to check if org's tenant is under membership tenant)
        // For now, we'll check if there's a parent relationship
        // This is a simplified check - full hierarchy check would require recursive query
        // For PR1, we'll focus on direct tenant match with includeChildren
      }
    }

    // LIST-scope grants (source='msp_scope')
    // Check if user has LIST-scope delegation for this org
    const [listScopeDelegation] = await db
      .select()
      .from(mspOrgDelegations)
      .where(
        and(
          eq(mspOrgDelegations.orgId, orgId),
          eq(mspOrgDelegations.subjectType, 'user'),
          eq(mspOrgDelegations.subjectId, userId),
          eq(mspOrgDelegations.source, 'msp_scope'),
          eq(mspOrgDelegations.supplierTenantId, orgRecord.tenantId),
          isNull(mspOrgDelegations.revokedAt),
          or(
            isNull(mspOrgDelegations.expiresAt),
            gt(mspOrgDelegations.expiresAt, new Date())
          )
        )
      )
      .limit(1)

    if (listScopeDelegation) {
      // Get MSP roles for the tenant membership
      const tenantMembership = allTenantMemberships.find((m) => m.tenantId === orgRecord.tenantId)
      if (tenantMembership) {
        // Get DB-based MSP role permissions
        const dbMspPerms = await getMspRolePermissionsFromDb(tenantMembership.id, moduleKey, orgRecord.tenantId)
        for (const perm of dbMspPerms) {
          delegatedGrants.add(perm)
        }

        // Also check legacy string-based MSP roles (for backwards compatibility)
        const mspRoles: TenantRole[] = []
        
        // Check primary role
        if (tenantMembership.role.startsWith('msp-')) {
          mspRoles.push(tenantMembership.role as TenantRole)
        }

        // Get additional roles
        const additionalRoles = await db
          .select({ roleKey: tenantMemberRoles.roleKey })
          .from(tenantMemberRoles)
          .where(eq(tenantMemberRoles.membershipId, tenantMembership.id))

        for (const r of additionalRoles) {
          if (r.roleKey.startsWith('msp-')) {
            mspRoles.push(r.roleKey as TenantRole)
          }
        }

        // If user has at least one legacy MSP role, get permission bundles (fallback to hardcoded)
        if (mspRoles.length > 0) {
          const mspPerms = await getModulePermissionsForMspRoles(mspRoles, moduleKey, orgRecord.tenantId)
          for (const perm of mspPerms) {
            delegatedGrants.add(perm)
          }
        }
      }
    }
  }

  // Effektiva permissions: baseline ∩ allowed, sen group grants/denies, delegation, sen user grants/denies
  const effective = new Set<string>()
  for (const perm of baseline) {
    if (allowed.has(perm) && !userDenies.has(perm)) {
      effective.add(perm)
    }
  }

  // delegation grants
  for (const perm of delegatedGrants) {
    if (allowed.has(perm) && !userDenies.has(perm)) {
      effective.add(perm)
    }
  }

  // Group grants/denies utan medlemskapshantering (förenkling): applicera alla grants, sen denies
  for (const perms of groupGrants.values()) {
    for (const perm of perms) {
      if (allowed.has(perm)) {
        effective.add(perm)
      }
    }
  }
  for (const perms of groupDenies.values()) {
    for (const perm of perms) {
      effective.delete(perm)
    }
  }

  // User grants/denies
  for (const perm of userGrants) {
    if (allowed.has(perm)) {
      effective.add(perm)
    }
  }
  for (const perm of userDenies) {
    effective.delete(perm)
  }

  return {
    allowedPermissions: allowed,
    baselinePermissions: baseline,
    groupGrants,
    groupDenies,
    userGrants,
    userDenies,
    delegatedGrants,
    effectivePermissions: effective,
    policy: effectivePolicy
  }
}

/**
 * Hard authorization helper for module permissions.
 * Uses resolveEffectiveModulePermissions and throws 403 on missing permission.
 */
export const requireModulePermission = async (
  event: H3Event,
  params: { orgId?: string; moduleKey: ModuleId; permissionKey: string }
) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const orgId = params.orgId ?? auth.currentOrgId
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Select an organization' })
  }

  if (auth.user.isSuperAdmin) {
    return { auth, orgId }
  }

  const db = getDb()
  const [org] = await db
    .select({ status: organizations.status })
    .from(organizations)
    .where(eq(organizations.id, orgId))
  if (!org) {
    throw createError({ statusCode: 404, message: 'Organisationen kunde inte hittas.' })
  }
  if (org.status !== 'active') {
    throw createError({ statusCode: 403, message: 'Organisationen är inaktiverad och kan inte användas.' })
  }

  // Permission evaluation
  const perms = await resolveEffectiveModulePermissions({
    orgId,
    moduleKey: params.moduleKey,
    userId: auth.user.id
  })

  if (perms.policy.mode === 'blocked') {
    throw createError({
      statusCode: 403,
      message: `Module ${params.moduleKey} is blocked for organization ${orgId}`
    })
  }

  if (!perms.effectivePermissions.has(params.permissionKey)) {
    throw createError({
      statusCode: 403,
      message: `Missing module permission ${params.permissionKey} for organization ${orgId}`
    })
  }

  return { auth, orgId, permissions: perms }
}


