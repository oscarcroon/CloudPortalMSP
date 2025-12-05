import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { organizations, organizationModulePolicies, tenantModulePolicies } from '~~/server/database/schema'
import { requirePermission } from '~~/server/utils/rbac'
import {
  getModulesByScope,
  type ModuleWithStatus
} from '~/lib/modules-helpers'

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value === 1
  }
  return fallback
}

const buildResponseItem = (
  module: ModuleWithStatus,
  tenantPolicy?: typeof tenantModulePolicies.$inferSelect,
  orgPolicy?: typeof organizationModulePolicies.$inferSelect
) => {
  const tenantEnabled = toBoolean(tenantPolicy?.enabled, true)
  const tenantDisabled = toBoolean(tenantPolicy?.disabled, false)
  const orgEnabled = toBoolean(orgPolicy?.enabled, tenantEnabled)
  const orgDisabled = toBoolean(orgPolicy?.disabled, false)

  const effectiveEnabled = tenantEnabled && orgEnabled
  const effectiveDisabled = tenantDisabled || orgDisabled

  return {
    key: module.key,
    name: module.name,
    description: module.description,
    category: module.category,
    layerKey: module.layerKey,
    rootRoute: module.rootRoute,
    scopes: module.scopes,
    status: module.status,
    featureFlag: module.featureFlag,
    requiredPermissions: module.requiredPermissions,
    tenantEnabled,
    tenantDisabled,
    orgEnabled,
    orgDisabled,
    effectiveEnabled,
    effectiveDisabled
  }
}

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const db = getDb()
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  const [tenantPolicies, orgPolicies] = await Promise.all([
    org.tenantId
      ? db
          .select()
          .from(tenantModulePolicies)
          .where(eq(tenantModulePolicies.tenantId, org.tenantId))
      : Promise.resolve([]),
    db
      .select()
      .from(organizationModulePolicies)
      .where(eq(organizationModulePolicies.organizationId, orgId))
  ])

  const modules = (() => {
    const all = [...getModulesByScope('org'), ...getModulesByScope('user')]
    const deduped = new Map<string, ModuleWithStatus>()
    all.forEach((module) => {
      deduped.set(module.key, module)
    })
    return Array.from(deduped.values())
  })()

  const tenantPolicyMap = new Map(tenantPolicies.map((policy) => [policy.moduleId, policy]))
  const orgPolicyMap = new Map(orgPolicies.map((policy) => [policy.moduleId, policy]))

  const knownKeys = new Set(modules.map((module) => module.key))

  tenantPolicies
    .filter((policy) => !knownKeys.has(policy.moduleId))
    .forEach((orphan) =>
      console.warn('[org-modules:get] Orphaned tenant module policy', {
        tenantId: org.tenantId,
        moduleId: orphan.moduleId
      })
    )

  orgPolicies
    .filter((policy) => !knownKeys.has(policy.moduleId))
    .forEach((orphan) =>
      console.warn('[org-modules:get] Orphaned org module policy', {
        orgId,
        moduleId: orphan.moduleId
      })
    )

  const items = modules.map((module) =>
    buildResponseItem(module, tenantPolicyMap.get(module.key), orgPolicyMap.get(module.key))
  )

  return {
    organizationId: orgId,
    modules: items
  }
})
