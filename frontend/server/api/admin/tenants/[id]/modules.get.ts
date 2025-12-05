import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { tenantModulePolicies } from '~~/server/database/schema'
import { requireTenantPermission } from '~~/server/utils/rbac'
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
  policy?: typeof tenantModulePolicies.$inferSelect
) => {
  const tenantEnabled = toBoolean(policy?.enabled, true)
  const tenantDisabled = toBoolean(policy?.disabled, false)
  const effectiveEnabled = tenantEnabled

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
    effectiveEnabled
  }
}

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  await requireTenantPermission(event, 'tenants:manage', tenantId)

  const db = getDb()
  const [policies, modules] = await Promise.all([
    db
      .select()
      .from(tenantModulePolicies)
      .where(eq(tenantModulePolicies.tenantId, tenantId)),
    getModulesByScope('tenant')
  ])

  const policyMap = new Map(policies.map((policy) => [policy.moduleId, policy]))
  const knownKeys = new Set(modules.map((module) => module.key))
  policies
    .filter((policy) => !knownKeys.has(policy.moduleId))
    .forEach((orphan) =>
      console.warn('[tenant-modules:get] Orphaned tenant module policy', {
        tenantId,
        moduleId: orphan.moduleId
      })
    )

  const items = modules.map((module) => buildResponseItem(module, policyMap.get(module.key)))

  return {
    tenantId,
    modules: items
  }
})
