import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import {
  distributorProviders,
  organizationModulePolicies,
  organizations,
  tenantModulePolicies,
  tenants,
  modules as modulesTable
} from '../database/schema'
import { getDb } from './db'
import { getModuleById, getModulesByScope } from '~/lib/modules'
import type { ModuleId } from '~/constants/modules'
import { getModulePermissions } from '~/constants/modules'
import type { DefaultOrgState, ModulePolicy, ModuleStatusDto, PolicyMode } from '~/types/modules'
import { getAllPluginModules } from '~~/server/lib/plugin-registry/registry'
import type { ModuleScope } from '~/lib/module-registry'

type TenantPolicyRow = typeof tenantModulePolicies.$inferSelect
type OrgPolicyRow = typeof organizationModulePolicies.$inferSelect
type FeatureFlags = Record<string, boolean | undefined>

const parseMode = (raw?: string | null): PolicyMode => {
  switch (raw) {
    case 'blocked':
    case 'allowlist':
    case 'default-closed':
    case 'inherit':
      return raw
    default:
      return 'inherit'
  }
}

const parseAllowedRoles = (raw?: string | null): string[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed.filter((role): role is string => typeof role === 'string')))
  } catch {
    return []
  }
}

const parsePermissionOverrides = (raw?: string | null): Record<string, boolean> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, boolean>>(
      (acc, [key, value]) => {
        if (typeof value === 'boolean' && typeof key === 'string') {
          acc[key] = value
        }
        return acc
      },
      {}
    )
  } catch {
    return {}
  }
}

const serializeAllowedRoles = (roles: string[]): string => JSON.stringify(Array.from(new Set(roles)))

const toPolicy = (
  moduleKey: string,
  row?: TenantPolicyRow | OrgPolicyRow | null
): ModulePolicy | null => {
  if (!row) return null
  // enabled and disabled can be explicitly false, so we need to check for undefined, not falsy
  const rowAny = row as any
  const enabledValue = rowAny.enabled !== undefined ? rowAny.enabled : true
  const disabledValue = rowAny.disabled !== undefined ? rowAny.disabled : false
  return {
    moduleKey,
    mode: parseMode(rowAny.mode),
    allowedRoles: parseAllowedRoles(rowAny.allowedRoles),
    permissionOverrides: parsePermissionOverrides(rowAny.permissionOverrides ?? null),
    enabled: enabledValue,
    disabled: disabledValue,
    comingSoonMessage: rowAny.comingSoonMessage ?? null,
    defaultOrgState: (rowAny.defaultOrgState as DefaultOrgState) ?? undefined,
    defaultOrgComingSoonMessage: rowAny.defaultOrgComingSoonMessage ?? undefined
  }
}

const basePolicyForModule = (
  moduleKey: string,
  permissionKeys: string[],
  defaultAllowedRoles?: string[]
): ModulePolicy => {
  const roles = defaultAllowedRoles ?? []
  return {
    moduleKey,
    mode: roles.length > 0 ? 'allowlist' : 'default-closed',
    allowedRoles: roles,
    allowedRolesSource: 'base',
    allowedPermissions: permissionKeys,
    allowedPermissionsSource: 'base'
  }
}

const mergePolicies = (
  upstream: ModulePolicy,
  current?: ModulePolicy | null,
  permissionKeys: string[] = []
): ModulePolicy => {
  if (!current || current.mode === 'inherit') {
    return upstream
  }

  if (upstream.mode === 'blocked') {
    return { ...upstream, mode: 'blocked', allowedRoles: [], allowedPermissions: [] }
  }

  if (current.mode === 'blocked') {
    return {
      moduleKey: upstream.moduleKey,
      mode: 'blocked',
      allowedRoles: [],
      allowedRolesSource: current.allowedRolesSource ?? upstream.allowedRolesSource,
      permissionOverrides: {
        ...(upstream.permissionOverrides ?? {}),
        ...(current.permissionOverrides ?? {})
      },
      allowedPermissions: [],
      allowedPermissionsSource: current.allowedPermissionsSource ?? upstream.allowedPermissionsSource
    }
  }

  if (current.mode === 'default-closed') {
    return {
      moduleKey: upstream.moduleKey,
      mode: 'default-closed',
      allowedRoles: [],
      allowedRolesSource: current.allowedRolesSource ?? upstream.allowedRolesSource,
      permissionOverrides: {
        ...(upstream.permissionOverrides ?? {}),
        ...(current.permissionOverrides ?? {})
      },
      allowedPermissions: upstream.allowedPermissions ?? permissionKeys,
      allowedPermissionsSource: current.allowedPermissionsSource ?? upstream.allowedPermissionsSource
    }
  }

  const mergedPermissionOverrides = {
    ...(upstream.permissionOverrides ?? {}),
    ...(current.permissionOverrides ?? {})
  }

  // allowlist
  const deduped = Array.from(new Set(current.allowedRoles ?? []))
  const mergedAllowedRoles =
    upstream.mode === 'allowlist'
      ? deduped.filter((role) => (upstream.allowedRoles ?? []).includes(role))
      : deduped

  const basePermissionSet = new Set(
    upstream.allowedPermissions && upstream.allowedPermissions.length > 0
      ? upstream.allowedPermissions
      : permissionKeys
  )

  let allowedPermissions = new Set(basePermissionSet)
  if (current.mode === 'allowlist') {
    const allowKeys = Object.entries(current.permissionOverrides ?? {})
      .filter(([, value]) => value !== false)
      .map(([key]) => key)

    const hasExplicitAllow = allowKeys.length > 0
    allowedPermissions = hasExplicitAllow
        ? new Set(allowKeys.filter((key) => basePermissionSet.has(key)))
      : current.allowedPermissions && current.allowedPermissions.length > 0
        ? new Set(current.allowedPermissions.filter((key) => basePermissionSet.has(key)))
        : new Set(basePermissionSet) // fallback: allow all module permissions to avoid accidental total block
  }

  for (const [key, value] of Object.entries(mergedPermissionOverrides)) {
    if (value === false) {
      allowedPermissions.delete(key)
    } else if (value === true && basePermissionSet.has(key)) {
      allowedPermissions.add(key)
    }
  }

  return {
    moduleKey: upstream.moduleKey,
    mode: 'allowlist',
    allowedRoles: mergedAllowedRoles,
    allowedRolesSource: current.allowedRolesSource ?? upstream.allowedRolesSource,
    permissionOverrides: mergedPermissionOverrides,
    allowedPermissions: Array.from(allowedPermissions),
    allowedPermissionsSource: current.allowedPermissionsSource ?? upstream.allowedPermissionsSource
  }
}

const isFeatureFlagEnabled = (featureFlag: string | undefined, featureFlags: FeatureFlags) => {
  if (!featureFlag) return true
  if (featureFlag in featureFlags) {
    return Boolean(featureFlags[featureFlag])
  }
  return true
}

const toDto = ({
  moduleMeta,
  tenantPolicy,
  orgPolicy,
  effectivePolicy,
  featureFlags,
  globalEnabled,
  globalDisabled: globalDisabledParam,
  globalComingSoonMessage,
  distributorEnabled: distributorEnabledParam,
  distributorDisabled: distributorDisabledParam,
  distributorComingSoonMessage,
  tenantComingSoonMessage,
  tenantVisible,
  tenantDisabled: tenantDisabledParam,
  orgVisible,
  orgDisabled: orgDisabledParam
}: {
  moduleMeta: ReturnType<typeof getModuleById>
  tenantPolicy?: ModulePolicy | null
  orgPolicy?: ModulePolicy | null
  effectivePolicy: ModulePolicy
  featureFlags: FeatureFlags
  globalEnabled: boolean
  globalDisabled?: boolean
  globalComingSoonMessage?: string | null
  distributorEnabled?: boolean
  distributorDisabled?: boolean
  distributorComingSoonMessage?: string | null
  tenantComingSoonMessage?: string | null
  tenantVisible: boolean
  tenantDisabled?: boolean
  orgVisible: boolean
  orgDisabled?: boolean
}): ModuleStatusDto => {
  const featureEnabled = isFeatureFlagEnabled(moduleMeta?.featureFlag, featureFlags)
  const statusEnabled = moduleMeta?.status !== 'deprecated'

  // Global disabled state from modules table
  // IMPORTANT: disabled != not enabled
  // - enabled=false means the module is NOT SHOWN at all (inactive)
  // - disabled=true means the module IS SHOWN but grayed out (deactivated/coming-soon)
  const globalDisabled = globalDisabledParam ?? false
  
  // Distributor enabled/disabled state (for providers linked to a distributor)
  // If distributorEnabled is undefined, assume true (no distributor or distributor hasn't set it)
  const distributorEnabled = distributorEnabledParam ?? true
  const distributorDisabled = distributorDisabledParam ?? false

  // Use enabled/disabled from policy if available, otherwise fall back to mode-based logic
  // enabled controls VISIBILITY (whether module appears in list)
  const tenantEnabledValue = tenantPolicy?.enabled ?? (tenantPolicy?.mode !== 'blocked')
  const orgEnabledValue = orgPolicy?.enabled ?? (orgPolicy?.mode !== 'blocked')
  
  // disabled controls GRAYED OUT state (module shows but is blocked)
  const tenantDisabledValue = tenantDisabledParam ?? tenantPolicy?.disabled ?? false
  const orgDisabledValue = orgDisabledParam ?? orgPolicy?.disabled ?? false

  // Visible flags (global/distributor/tenant/org) control whether the module is LISTED
  // Note: disabled does NOT affect visibility - disabled modules should still be shown
  // enabled cascades: global -> distributor -> tenant -> org
  const tenantEnabled = globalEnabled && distributorEnabled && tenantVisible && featureEnabled && statusEnabled && tenantEnabledValue
  const orgEnabled = tenantEnabled && orgVisible && orgEnabledValue

  // Effective enabled means the module is VISIBLE in the list
  // This should NOT consider disabled state - disabled modules are still visible
  // enabled cascades: global -> distributor -> tenant -> org
  const effectiveEnabledValue = effectivePolicy.enabled ?? (effectivePolicy.mode !== 'blocked')
  const effectiveEnabled = globalEnabled && distributorEnabled && tenantVisible && orgVisible && featureEnabled && statusEnabled && effectiveEnabledValue

  // Disabled cascades: global -> distributor -> tenant -> org
  // A module is disabled if ANY level has disabled=true
  const tenantDisabled = globalDisabled || distributorDisabled || tenantDisabledValue
  const orgDisabled = tenantDisabled || orgDisabledValue
  const effectiveDisabled = globalDisabled || distributorDisabled || tenantDisabledValue || orgDisabledValue

  // Coming soon message: inherit from higher levels if not overridden at lower level
  // Priority: org -> tenant -> distributor -> global
  const resolvedComingSoonMessage = 
    orgPolicy?.comingSoonMessage ?? 
    tenantComingSoonMessage ?? 
    distributorComingSoonMessage ??
    globalComingSoonMessage ?? 
    null

  return {
    key: moduleMeta?.key ?? '',
    name: moduleMeta?.name ?? '',
    description: moduleMeta?.description ?? '',
    descriptionKey: moduleMeta?.descriptionKey ?? '',
    category: moduleMeta?.category ?? '',
    layerKey: moduleMeta?.layerKey ?? '',
    rootRoute: moduleMeta?.rootRoute ?? '',
    icon: moduleMeta?.icon ?? null,
    status: moduleMeta?.status ?? 'active',
    scopes: moduleMeta?.scopes ?? [],
    featureFlag: moduleMeta?.featureFlag,
    requiredPermissions: moduleMeta?.requiredPermissions ?? [],
    moduleRoles: moduleMeta?.moduleRoles ?? [],
    roles: moduleMeta?.moduleRoles ?? [],
    tenantPolicy: tenantPolicy ? { ...tenantPolicy, comingSoonMessage: tenantComingSoonMessage ?? globalComingSoonMessage } : undefined,
    orgPolicy: orgPolicy ?? undefined,
    effectivePolicy: { ...effectivePolicy, comingSoonMessage: resolvedComingSoonMessage },
    tenantEnabled,
    orgEnabled,
    effectiveEnabled,
    tenantDisabled,
    orgDisabled,
    effectiveDisabled,
    // Explicit resolved coming soon message for easy frontend access
    comingSoonMessage: resolvedComingSoonMessage
  }
}

const upsertTenantPolicy = async (tenantId: string, moduleId: ModuleId, policy: ModulePolicy) => {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(tenantModulePolicies)
    .where(and(eq(tenantModulePolicies.tenantId, tenantId), eq(tenantModulePolicies.moduleId, moduleId)))

  const values = {
    tenantId,
    moduleId,
    mode: policy.mode,
    allowedRoles: serializeAllowedRoles(policy.allowedRoles ?? []),
    enabled: policy.enabled ?? (policy.mode !== 'blocked'),
    disabled: policy.disabled ?? false,
    comingSoonMessage: policy.comingSoonMessage ?? null,
    permissionOverrides: policy.permissionOverrides ? JSON.stringify(policy.permissionOverrides) : null,
    defaultOrgState: policy.defaultOrgState ?? 'disabled',
    defaultOrgComingSoonMessage: policy.defaultOrgComingSoonMessage ?? null
  }

  if (existing) {
    await db
      .update(tenantModulePolicies)
      .set({
        ...values,
        updatedAt: new Date()
      })
      .where(eq(tenantModulePolicies.id, existing.id))
  } else {
    await db.insert(tenantModulePolicies).values({
      id: createId(),
      ...values
    } as any)
  }
}

const upsertOrgPolicy = async (organizationId: string, moduleId: ModuleId, policy: ModulePolicy) => {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(organizationModulePolicies)
    .where(
      and(
        eq(organizationModulePolicies.organizationId, organizationId),
        eq(organizationModulePolicies.moduleId, moduleId)
      )
    )

  const values = {
    organizationId,
    moduleId,
    mode: policy.mode,
    allowedRoles: serializeAllowedRoles(policy.allowedRoles ?? []),
    enabled: policy.enabled ?? (policy.mode !== 'blocked'),
    disabled: policy.disabled ?? false,
    comingSoonMessage: policy.comingSoonMessage ?? null,
    permissionOverrides: policy.permissionOverrides ? JSON.stringify(policy.permissionOverrides) : null
  }

  if (existing) {
    await db
      .update(organizationModulePolicies)
      .set({
        ...values,
        updatedAt: new Date()
      })
      .where(eq(organizationModulePolicies.id, existing.id))
  } else {
    await db.insert(organizationModulePolicies).values({
      id: createId(),
      ...values
    } as any)
  }
}

export const getTenantModulePolicy = async (
  tenantId: string,
  moduleId: ModuleId
): Promise<ModulePolicy | null> => {
  const db = getDb()
  const [row] = await db
    .select()
    .from(tenantModulePolicies)
    .where(and(eq(tenantModulePolicies.tenantId, tenantId), eq(tenantModulePolicies.moduleId, moduleId)))
  return toPolicy(moduleId, row)
}

export const getOrganizationModulePolicy = async (
  organizationId: string,
  moduleId: ModuleId
): Promise<ModulePolicy | null> => {
  const db = getDb()
  const [row] = await db
    .select()
    .from(organizationModulePolicies)
    .where(
      and(
        eq(organizationModulePolicies.organizationId, organizationId),
        eq(organizationModulePolicies.moduleId, moduleId)
      )
    )
  return toPolicy(moduleId, row)
}

export const setTenantModulePolicy = async (
  tenantId: string,
  moduleId: ModuleId,
  policy: ModulePolicy
) => {
  await upsertTenantPolicy(tenantId, moduleId, policy)
}

export const setOrganizationModulePolicy = async (
  organizationId: string,
  moduleId: ModuleId,
  policy: ModulePolicy
) => {
  await upsertOrgPolicy(organizationId, moduleId, policy)
}

const resolveDistributorPolicy = async (
  tenantId: string,
  moduleId: ModuleId
): Promise<ModulePolicy | null> => {
  const db = getDb()
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))
  if (!tenant || tenant.type !== 'provider') return null

  const [link] = await db
    .select()
    .from(distributorProviders)
    .where(eq(distributorProviders.providerId, tenantId))

  if (!link) return null
  return getTenantModulePolicy(link.distributorId, moduleId)
}

const buildTenantDto = async (
  tenantId: string,
  featureFlags: FeatureFlags
): Promise<ModuleStatusDto[]> => {
  const db = getDb()

  // Global enabled modules - also fetch disabled and comingSoonMessage
  const enabledModules = await db
    .select({ 
      key: modulesTable.key, 
      enabled: modulesTable.enabled,
      disabled: modulesTable.disabled,
      comingSoonMessage: modulesTable.comingSoonMessage
    })
    .from(modulesTable)
    .where(eq(modulesTable.enabled, true))
  
  // Build a map with global status info
  const globalModuleStatus = new Map(
    enabledModules.map((m) => [m.key, { 
      enabled: m.enabled, 
      disabled: m.disabled ?? false,
      comingSoonMessage: m.comingSoonMessage ?? null
    }])
  )
  const enabledKeys = new Set(enabledModules.filter((m) => m.enabled).map((m) => m.key))

  // Hämta moduler via registry och filtrera på scope + enabled
  const moduleList = getModulesByScope('tenant').filter((m) => enabledKeys.has(m.key))

  const policies = await db
    .select()
    .from(tenantModulePolicies)
    .where(eq(tenantModulePolicies.tenantId, tenantId))
  const policyMap = new Map(policies.map((row) => [row.moduleId, row]))

  const results: ModuleStatusDto[] = []
  for (const module of moduleList) {
    if (!enabledKeys.has(module.key)) continue

    const globalStatus = globalModuleStatus.get(module.key)
    const permissionKeys = getModulePermissions(module.key as ModuleId)
    const base = basePolicyForModule(module.key, permissionKeys, module.defaultAllowedRoles)
    const distributorPolicy = await resolveDistributorPolicy(tenantId, module.key as ModuleId)
    const tenantPolicy = toPolicy(module.key, policyMap.get(module.key))
    const upstream = mergePolicies(base, distributorPolicy, permissionKeys)
    const effectivePolicy = mergePolicies(upstream, tenantPolicy, permissionKeys)

    const tenantRow = policyMap.get(module.key)
    const tenantVisible = tenantRow?.enabled !== false
    const tenantDisabled = tenantRow?.disabled === true
    
    // Distributor enabled/disabled/comingSoonMessage propagates to providers
    // If distributorPolicy is null, there's no distributor or distributor hasn't set a policy
    // In that case, enabled defaults to true (no restriction)
    const distributorEnabled = distributorPolicy?.enabled ?? true
    const distributorDisabled = distributorPolicy?.disabled ?? false
    const distributorComingSoonMessage = distributorPolicy?.comingSoonMessage ?? null

    results.push(
      toDto({
        moduleMeta: module,
        tenantPolicy,
        effectivePolicy,
        featureFlags,
        globalEnabled: true,
        globalDisabled: globalStatus?.disabled ?? false,
        globalComingSoonMessage: globalStatus?.comingSoonMessage ?? null,
        distributorEnabled,
        distributorDisabled,
        distributorComingSoonMessage,
        tenantComingSoonMessage: tenantPolicy?.comingSoonMessage ?? null,
        tenantVisible,
        tenantDisabled,
        orgVisible: true,
        orgDisabled: false
      })
    )
  }

  return results
}

export const getTenantModulesStatus = async (
  tenantId: string,
  featureFlags: FeatureFlags = {}
): Promise<ModuleStatusDto[]> => {
  return buildTenantDto(tenantId, featureFlags)
}

export const getOrganizationModulesStatus = async (
  organizationId: string,
  featureFlags: FeatureFlags = {}
): Promise<ModuleStatusDto[]> => {
  const db = getDb()
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId))
  if (!org) {
    return []
  }

  const orgPolicies = await db
    .select()
    .from(organizationModulePolicies)
    .where(eq(organizationModulePolicies.organizationId, organizationId))
  const orgPolicyMap = new Map(orgPolicies.map((row) => [row.moduleId, row]))

  const tenantPolicies = org.tenantId
    ? await db
        .select()
        .from(tenantModulePolicies)
        .where(eq(tenantModulePolicies.tenantId, org.tenantId))
    : []
  const tenantPolicyMap = new Map(tenantPolicies.map((row) => [row.moduleId, row]))

  // Global enabled modules - also fetch disabled and comingSoonMessage
  const enabledModules = await db
    .select({ 
      key: modulesTable.key, 
      enabled: modulesTable.enabled,
      disabled: modulesTable.disabled,
      comingSoonMessage: modulesTable.comingSoonMessage
    })
    .from(modulesTable)
    .where(eq(modulesTable.enabled, true))
  
  // Build a map with global status info
  const globalModuleStatus = new Map(
    enabledModules.map((m) => [m.key, { 
      enabled: m.enabled, 
      disabled: m.disabled ?? false,
      comingSoonMessage: m.comingSoonMessage ?? null
    }])
  )
  const enabledKeys = new Set(enabledModules.filter((m) => m.enabled).map((m) => m.key))

  // Hämta moduler via registry och filtrera på scopes + enabled
  const scopedModules = [...getModulesByScope('org'), ...getModulesByScope('user')].filter((m) =>
    enabledKeys.has(m.key)
  )
  const modulesMap = new Map<string, ReturnType<typeof getModuleById>>()
  scopedModules.forEach((module) => {
    if (!module?.key) return
    modulesMap.set(module.key, module)
  })

  const results: ModuleStatusDto[] = []
  for (const module of modulesMap.values()) {
    if (!module) continue
    const globalStatus = globalModuleStatus.get(module.key)
    const permissionKeys = getModulePermissions(module.key as ModuleId)
    const base = basePolicyForModule(module.key, permissionKeys, module.defaultAllowedRoles)
    const distributorPolicy =
      org.tenantId && module.key
        ? await resolveDistributorPolicy(org.tenantId, module.key as ModuleId)
        : null
    const tenantPolicy = toPolicy(module.key, tenantPolicyMap.get(module.key))
    const orgPolicy = toPolicy(module.key, orgPolicyMap.get(module.key))

    const tenantEffective = mergePolicies(
      mergePolicies(base, distributorPolicy, permissionKeys),
      tenantPolicy,
      permissionKeys
    )
    const effectivePolicy = mergePolicies(tenantEffective, orgPolicy, permissionKeys)

    const tenantRow = tenantPolicyMap.get(module.key)
    const orgRow = orgPolicyMap.get(module.key)
    const tenantVisible = tenantRow?.enabled !== false
    const tenantDisabled = tenantRow?.disabled === true
    const orgVisible = orgRow?.enabled !== false
    const orgDisabled = orgRow?.disabled === true
    
    // Distributor enabled/disabled/comingSoonMessage propagates to providers and their orgs
    // If distributorPolicy is null, there's no distributor or distributor hasn't set a policy
    // In that case, enabled defaults to true (no restriction)
    const distributorEnabled = distributorPolicy?.enabled ?? true
    const distributorDisabled = distributorPolicy?.disabled ?? false
    const distributorComingSoonMessage = distributorPolicy?.comingSoonMessage ?? null

    results.push(
      toDto({
        moduleMeta: module,
        tenantPolicy: tenantEffective,
        orgPolicy,
        effectivePolicy,
        featureFlags,
        globalEnabled: true,
        globalDisabled: globalStatus?.disabled ?? false,
        globalComingSoonMessage: globalStatus?.comingSoonMessage ?? null,
        distributorEnabled,
        distributorDisabled,
        distributorComingSoonMessage,
        tenantComingSoonMessage: tenantPolicy?.comingSoonMessage ?? null,
        tenantVisible,
        tenantDisabled,
        orgVisible,
        orgDisabled
      })
    )
  }

  return results
}

export const getEffectiveModulePolicyForOrg = async (
  organizationId: string,
  moduleId: ModuleId
): Promise<ModulePolicy & { enabled: boolean; disabled: boolean }> => {
  const modules = await getOrganizationModulesStatus(organizationId)
  const match = modules.find((mod) => mod.key === moduleId)
  const moduleMeta = getModuleById(moduleId)
  const permissionKeys = getModulePermissions(moduleId as ModuleId)
  const policy =
    match?.effectivePolicy ??
    basePolicyForModule(moduleId, permissionKeys, moduleMeta?.defaultAllowedRoles ?? [])

  return {
    ...policy,
    enabled: policy.mode !== 'blocked',
    disabled: policy.mode === 'blocked'
  }
}

export const isModuleEnabledForOrg = async (
  organizationId: string,
  moduleId: ModuleId
): Promise<boolean> => {
  const policy = await getEffectiveModulePolicyForOrg(organizationId, moduleId)
  return policy.mode !== 'blocked'
}

export const isModulePermissionAllowed = async (
  organizationId: string,
  moduleId: ModuleId,
  permission: string
): Promise<boolean> => {
  const policy = await getEffectiveModulePolicyForOrg(organizationId, moduleId)

  // Blocked modules always deny
  if (policy.mode === 'blocked') {
    return false
  }

  // If the permission is not part of this module, allow (handled by RBAC elsewhere)
  const modulePermissions = getModulePermissions(moduleId as any)
  if (!modulePermissions.includes(permission as any)) {
    return true
  }

  const allowedPermissions = new Set(
    policy.allowedPermissions && policy.allowedPermissions.length > 0
      ? policy.allowedPermissions
      : modulePermissions
  )

  // If allowlist mode but nothing allowed, deny
  if (policy.mode === 'allowlist' && allowedPermissions.size === 0) {
    return false
  }

  return allowedPermissions.has(permission)
}

export const getTenantModuleDefaults = async (
  tenantId: string
): Promise<Map<string, { defaultOrgState: DefaultOrgState; defaultOrgComingSoonMessage: string | null }>> => {
  const db = getDb()
  const rows = await db
    .select()
    .from(tenantModulePolicies)
    .where(eq(tenantModulePolicies.tenantId, tenantId))

  const defaults = new Map<string, { defaultOrgState: DefaultOrgState; defaultOrgComingSoonMessage: string | null }>()
  for (const row of rows) {
    const state = (row.defaultOrgState as DefaultOrgState) || 'disabled'
    defaults.set(row.moduleId, {
      defaultOrgState: state,
      defaultOrgComingSoonMessage: row.defaultOrgComingSoonMessage ?? null
    })
  }
  return defaults
}

