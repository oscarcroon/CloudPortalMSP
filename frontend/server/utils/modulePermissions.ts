import { and, eq } from 'drizzle-orm'
import { createError, H3Event } from 'h3'
import { manifests } from '~~/layers/plugin-manifests'
import {
  organizationModulePolicies,
  tenantModulePolicies,
  userModulePermissions,
  organizationMemberships,
  mspOrgDelegations,
  mspOrgDelegationPermissions,
  orgGroupModulePermissions,
  orgGroupMembers,
  organizations
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { ensureAuthState } from './session'
import type { ModuleId } from '~/constants/modules'
import type { RbacRole } from '~/constants/rbac'
import type { ModulePolicy } from '~/types/modules'

type PermissionKey = string

type Effect = 'grant' | 'deny'

export interface EffectiveModulePermissions {
  allowedPermissions: Set<PermissionKey>
  baselinePermissions: Set<PermissionKey>
  groupGrants: Map<string, Set<PermissionKey>> // groupId -> perms (unused when group table saknas)
  groupDenies: Map<string, Set<PermissionKey>>
  userGrants: Set<PermissionKey>
  userDenies: Set<PermissionKey>
  delegatedGrants?: Set<PermissionKey>
  effectivePermissions: Set<PermissionKey>
  policy: ModulePolicy & { enabled: boolean; disabled: boolean }
  debug?: {
    tenantPolicy?: ModulePolicy | null
    orgPolicy?: ModulePolicy | null
  }
}

const getModuleManifest = (moduleKey: string) =>
  manifests.find((m) => m.module.key === moduleKey)

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
  const list = rbacDefaults[userRole ?? ''] ?? []
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

const parseModulePolicy = (raw?: any | null): ModulePolicy | null => {
  if (!raw) return null
  return {
    moduleKey: raw.moduleId ?? raw.moduleKey ?? '',
    mode: (raw.mode ?? 'inherit') as ModulePolicy['mode'],
    allowedRoles: raw.allowedRoles ? JSON.parse(raw.allowedRoles) : [],
    allowedPermissions: raw.permissionOverrides ? Object.keys(JSON.parse(raw.permissionOverrides)) : [],
    permissionOverrides: raw.permissionOverrides ? JSON.parse(raw.permissionOverrides) : undefined
  }
}

const mergePolicies = (upstream: ModulePolicy, current: ModulePolicy | null, permissionKeys: string[]) => {
  if (!current || current.mode === 'inherit') {
    return upstream
  }
  if (upstream.mode === 'blocked' || current.mode === 'blocked') {
    return { ...current, mode: 'blocked', allowedPermissions: [], allowedRoles: [] }
  }
  const base = new Set(
    upstream.allowedPermissions && upstream.allowedPermissions.length > 0 ? upstream.allowedPermissions : permissionKeys
  )
  const mergedOverrides = {
    ...(upstream.permissionOverrides ?? {}),
    ...(current.permissionOverrides ?? {})
  }
  const allowKeys = Object.entries(mergedOverrides)
    .filter(([, v]) => v !== false)
    .map(([k]) => k)
  const allowFromField =
    current.allowedPermissions && current.allowedPermissions.length > 0
      ? current.allowedPermissions.filter((k) => base.has(k))
      : []
  const allowedPermissions =
    current.mode === 'allowlist'
      ? (allowKeys.length ? allowKeys : allowFromField).filter((k) => base.has(k))
      : Array.from(base)
  return {
    moduleKey: upstream.moduleKey,
    mode: current.mode as ModulePolicy['mode'],
    allowedPermissions,
    allowedRoles: current.allowedRoles ?? [],
    permissionOverrides: mergedOverrides
  } as ModulePolicy
}

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

  // Policy: tenant + org
  const [orgPolicyRaw] = await db
    .select()
    .from(organizationModulePolicies)
    .where(and(eq(organizationModulePolicies.organizationId, orgId), eq(organizationModulePolicies.moduleId, moduleKey)))

  const orgPolicy = parseModulePolicy(orgPolicyRaw)

  let tenantPolicy: ModulePolicy | null = null
  if (orgPolicyRaw?.organizationId) {
    const [tenantRow] = await db
      .select()
      .from(tenantModulePolicies)
      .where(and(eq(tenantModulePolicies.tenantId, orgPolicyRaw.organizationId), eq(tenantModulePolicies.moduleId, moduleKey)))
    tenantPolicy = parseModulePolicy(tenantRow)
  }

  const basePolicy: ModulePolicy = {
    moduleKey,
    mode: 'allowlist',
    allowedRoles: [],
    allowedPermissions: permissionKeys,
    allowedPermissionsSource: 'base'
  }

  const tenantMerged = mergePolicies(basePolicy, tenantPolicy, permissionKeys)
  const effectivePolicy = mergePolicies(tenantMerged, orgPolicy, permissionKeys)

  if (effectivePolicy.mode === 'blocked') {
    const blockedPolicy: ModulePolicy & { enabled: boolean; disabled: boolean } = {
      ...(effectivePolicy as ModulePolicy),
      enabled: false,
      disabled: true
    }
    return {
      allowedPermissions: new Set(),
      baselinePermissions: baseline,
      groupGrants: new Map(),
      groupDenies: new Map(),
      userGrants: new Set(),
      userDenies: new Set(),
      effectivePermissions: new Set(),
      policy: blockedPolicy,
      debug: { tenantPolicy, orgPolicy }
    }
  }

  // Allowed permissions (policy)
  const allowed = new Set<string>(
    effectivePolicy.allowedPermissions && effectivePolicy.allowedPermissions.length > 0
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

  const userOverrides =
    userPerm?.deniedPermissions && userPerm.deniedPermissions.trim()
      ? (JSON.parse(userPerm.deniedPermissions) as Record<string, Effect>)
      : {}

  const userGrants = new Set<string>()
  const userDenies = new Set<string>()
  for (const [perm, value] of Object.entries(userOverrides)) {
    if (value === 'grant') {
      userGrants.add(perm)
    } else if (value === 'deny' || value === true) {
      userDenies.add(perm)
    }
  }

  // Delegation grants (MSP → Org)
  const now = Date.now()
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
    const isExpired = expiresAt !== null && expiresAt !== undefined && expiresAt <= now
    if (isRevoked || isExpired) continue
    if (row.permissionKey) {
      delegatedGrants.add(row.permissionKey)
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

  const policyWithFlags: ModulePolicy & { enabled: boolean; disabled: boolean } = {
    ...(effectivePolicy as ModulePolicy),
    enabled: effectivePolicy.mode !== 'blocked',
    disabled: effectivePolicy.mode === 'blocked'
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
    policy: policyWithFlags,
    debug: { tenantPolicy, orgPolicy }
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


