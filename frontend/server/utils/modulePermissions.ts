import { and, eq } from 'drizzle-orm'
import { manifests } from '~~/layers/plugin-manifests'
import {
  organizationModulePolicies,
  tenantModulePolicies,
  userModulePermissions,
  organizationMemberships
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
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
  const manifestPermissions = new Set(manifest.permissions.map((p) => p.key))
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
    mode: raw.mode ?? 'inherit',
    allowedRoles: raw.allowedRoles ? JSON.parse(raw.allowedRoles) : [],
    allowedPermissions: raw.permissionOverrides ? Object.keys(JSON.parse(raw.permissionOverrides)) : [],
    permissionOverrides: raw.permissionOverrides ? JSON.parse(raw.permissionOverrides) : undefined,
    enabled: raw.enabled ?? true,
    disabled: raw.disabled ?? false
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
    mode: current.mode,
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
    return {
      allowedPermissions: new Set(),
      baselinePermissions: new Set(),
      groupGrants: new Map(),
      groupDenies: new Map(),
      userGrants: new Set(),
      userDenies: new Set(),
      effectivePermissions: new Set(),
      policy: {
        moduleKey,
        mode: 'blocked',
        allowedPermissions: [],
        allowedRoles: [],
        enabled: false,
        disabled: true
      }
    }
  }

  const permissionKeys = manifest.permissions.map((p) => p.key)
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
    allowedPermissionsSource: 'base',
    enabled: true,
    disabled: false
  }

  const tenantMerged = mergePolicies(basePolicy, tenantPolicy, permissionKeys)
  const effectivePolicy = mergePolicies(tenantMerged, orgPolicy, permissionKeys)

  if (effectivePolicy.mode === 'blocked') {
    return {
      allowedPermissions: new Set(),
      baselinePermissions: baseline,
      groupGrants: new Map(),
      groupDenies: new Map(),
      userGrants: new Set(),
      userDenies: new Set(),
      effectivePermissions: new Set(),
      policy: { ...effectivePolicy, enabled: false, disabled: true },
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

  // Effektiva permissions: baseline ∩ allowed, sen group grants/denies, sen user grants/denies
  const effective = new Set<string>()
  for (const perm of baseline) {
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
    effectivePermissions: effective,
    policy: { ...(effectivePolicy as any), enabled: effectivePolicy.mode !== 'blocked', disabled: effectivePolicy.mode === 'blocked' },
    debug: { tenantPolicy, orgPolicy }
  }
}


