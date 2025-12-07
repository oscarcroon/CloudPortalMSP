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
import type { ModulePolicy, ModuleStatusDto, PolicyMode } from '~/types/modules'
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

const serializeAllowedRoles = (roles: string[]): string => JSON.stringify(Array.from(new Set(roles)))

const toPolicy = (
  moduleKey: string,
  row?: TenantPolicyRow | OrgPolicyRow | null
): ModulePolicy | null => {
  if (!row) return null
  return {
    moduleKey,
    mode: parseMode((row as any).mode),
    allowedRoles: parseAllowedRoles((row as any).allowedRoles)
  }
}

const basePolicyForModule = (moduleKey: string, defaultAllowedRoles?: string[]): ModulePolicy => {
  const roles = defaultAllowedRoles ?? []
  return {
    moduleKey,
    mode: roles.length > 0 ? 'allowlist' : 'default-closed',
    allowedRoles: roles
  }
}

const mergePolicies = (upstream: ModulePolicy, current?: ModulePolicy | null): ModulePolicy => {
  if (!current || current.mode === 'inherit') {
    return upstream
  }

  if (upstream.mode === 'blocked') {
    return { ...upstream, mode: 'blocked', allowedRoles: [] }
  }

  if (current.mode === 'blocked') {
    return { moduleKey: upstream.moduleKey, mode: 'blocked', allowedRoles: [] }
  }

  if (current.mode === 'default-closed') {
    return { moduleKey: upstream.moduleKey, mode: 'default-closed', allowedRoles: [] }
  }

  // allowlist
  const deduped = Array.from(new Set(current.allowedRoles ?? []))
  if (upstream.mode === 'allowlist') {
    const allowedSet = new Set(upstream.allowedRoles ?? [])
    return {
      moduleKey: upstream.moduleKey,
      mode: 'allowlist',
      allowedRoles: deduped.filter((role) => allowedSet.has(role))
    }
  }

  // upstream default-closed -> downstream may open specific roles
  return { moduleKey: upstream.moduleKey, mode: 'allowlist', allowedRoles: deduped }
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
  tenantVisible,
  orgVisible
}: {
  moduleMeta: ReturnType<typeof getModuleById>
  tenantPolicy?: ModulePolicy | null
  orgPolicy?: ModulePolicy | null
  effectivePolicy: ModulePolicy
  featureFlags: FeatureFlags
  globalEnabled: boolean
  tenantVisible: boolean
  orgVisible: boolean
}): ModuleStatusDto => {
  const featureEnabled = isFeatureFlagEnabled(moduleMeta?.featureFlag, featureFlags)
  const statusEnabled = moduleMeta?.status !== 'deprecated'

  // Visible flags (global/tenant/org) control whether the module is listed
  const tenantEnabled = globalEnabled && tenantVisible && featureEnabled && statusEnabled && tenantPolicy?.mode !== 'blocked'
  const orgEnabled = tenantEnabled && orgVisible && orgPolicy?.mode !== 'blocked'

  // Effective flag is based on merged policy, plus visibility chain
  const effectiveEnabled = globalEnabled && tenantVisible && orgVisible && featureEnabled && statusEnabled && effectivePolicy.mode !== 'blocked'

  const tenantDisabled = !tenantVisible || tenantPolicy?.mode === 'blocked'
  const orgDisabled = !orgVisible || orgPolicy?.mode === 'blocked'
  const effectiveDisabled = !effectiveEnabled

  return {
    key: moduleMeta?.key ?? '',
    name: moduleMeta?.name ?? '',
    description: moduleMeta?.description ?? '',
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
    tenantPolicy: tenantPolicy ?? undefined,
    orgPolicy: orgPolicy ?? undefined,
    effectivePolicy,
    tenantEnabled,
    orgEnabled,
    effectiveEnabled,
    tenantDisabled,
    orgDisabled,
    effectiveDisabled
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
    enabled: policy.mode !== 'blocked',
    disabled: policy.mode === 'default-closed' ? false : false,
    permissionOverrides: null
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
    enabled: policy.mode !== 'blocked',
    disabled: policy.mode === 'default-closed' ? false : false,
    permissionOverrides: null
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

  // Global enabled modules
  const enabledModules = await db
    .select({ key: modulesTable.key, enabled: modulesTable.enabled })
    .from(modulesTable)
    .where(eq(modulesTable.enabled, true))
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

    const base = basePolicyForModule(module.key, module.defaultAllowedRoles)
    const distributorPolicy = await resolveDistributorPolicy(tenantId, module.key as ModuleId)
    const tenantPolicy = toPolicy(module.key, policyMap.get(module.key))
    const upstream = mergePolicies(base, distributorPolicy)
    const effectivePolicy = mergePolicies(upstream, tenantPolicy)

    const tenantRow = policyMap.get(module.key)
    const tenantVisible = tenantRow?.enabled !== false

    results.push(
      toDto({
        moduleMeta: module,
        tenantPolicy,
        effectivePolicy,
        featureFlags,
        globalEnabled: true,
        tenantVisible,
        orgVisible: true
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

  // Global enabled modules
  const enabledModules = await db
    .select({ key: modulesTable.key, enabled: modulesTable.enabled })
    .from(modulesTable)
    .where(eq(modulesTable.enabled, true))
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
    const base = basePolicyForModule(module.key, module.defaultAllowedRoles)
    const distributorPolicy =
      org.tenantId && module.key
        ? await resolveDistributorPolicy(org.tenantId, module.key as ModuleId)
        : null
    const tenantPolicy = toPolicy(module.key, tenantPolicyMap.get(module.key))
    const orgPolicy = toPolicy(module.key, orgPolicyMap.get(module.key))

    const tenantEffective = mergePolicies(mergePolicies(base, distributorPolicy), tenantPolicy)
    const effectivePolicy = mergePolicies(tenantEffective, orgPolicy)

    const tenantRow = tenantPolicyMap.get(module.key)
    const orgRow = orgPolicyMap.get(module.key)

    results.push(
      toDto({
        moduleMeta: module,
        tenantPolicy: tenantEffective,
        orgPolicy,
        effectivePolicy,
        featureFlags,
        globalEnabled: true,
        tenantVisible: tenantRow?.enabled !== false,
        orgVisible: orgRow?.enabled !== false
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
  const policy =
    match?.effectivePolicy ??
    basePolicyForModule(moduleId, moduleMeta?.defaultAllowedRoles ?? [])

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

  // No per-permission overrides implemented in new model; rely on mode
  return true
}

