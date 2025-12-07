import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~~/server/utils/rbac'
import {
  getOrganizationModulePolicy,
  getOrganizationModulesStatus,
  setOrganizationModulePolicy
} from '~~/server/utils/modulePolicy'
import { getModuleById } from '~/lib/modules'
import type { ModuleId } from '~/constants/modules'
import type { ModulePolicy } from '~/types/modules'
import { logOrganizationAction } from '~~/server/utils/audit'

const bodySchema = z.object({
  moduleKey: z.string(),
  mode: z.enum(['inherit', 'default-closed', 'allowlist', 'blocked']),
  allowedRoles: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  disabled: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  const body = bodySchema.parse(await readBody(event))
  const { moduleKey, mode, allowedRoles, enabled, disabled } = body

  await requirePermission(event, 'org:manage', orgId)

  const module = getModuleById(moduleKey as ModuleId)
  if (!module) {
    throw createError({ statusCode: 400, message: `Invalid module key: ${moduleKey}` })
  }

  const roleDefinitions = module.moduleRoles ?? module.roles ?? []
  if (allowedRoles && allowedRoles.length > 0) {
    const validRoleKeys = new Set(roleDefinitions.map((role) => role.key))
    const invalid = allowedRoles.filter((role) => !validRoleKeys.has(role))
    if (invalid.length) {
      throw createError({
        statusCode: 400,
        message: `Invalid module roles for ${moduleKey}: ${invalid.join(', ')}`
      })
    }
  }

  const currentModules = await getOrganizationModulesStatus(orgId)
  const current = currentModules.find((m) => m.key === moduleKey)
  if (current?.tenantPolicy?.mode === 'blocked' && mode !== 'blocked') {
    throw createError({
      statusCode: 403,
      message: 'Module is blocked at tenant level'
    })
  }

  const normalizedRoles =
    mode === 'allowlist'
      ? Array.from(new Set(allowedRoles ?? [])).filter(Boolean)
      : []

  const previousPolicy = await getOrganizationModulePolicy(orgId, moduleKey as ModuleId)

  const policy: ModulePolicy = {
    moduleKey,
    mode,
    allowedRoles: normalizedRoles,
    enabled: enabled ?? true,
    disabled: disabled ?? false
  } as any

  await setOrganizationModulePolicy(orgId, moduleKey as ModuleId, policy)

  const updatedModules = await getOrganizationModulesStatus(orgId)
  const updated = updatedModules.find((item) => item.key === moduleKey)

  if (previousPolicy?.mode !== policy.mode || previousPolicy?.allowedRoles !== policy.allowedRoles) {
    await logOrganizationAction(
      event,
      policy.mode === 'blocked' ? 'MODULE_DISABLED' : 'MODULE_ENABLED',
      {
        moduleKey,
        previousMode: previousPolicy?.mode ?? 'inherit',
        newMode: policy.mode,
        previousAllowedRoles: previousPolicy?.allowedRoles ?? [],
        newAllowedRoles: policy.allowedRoles
      },
      orgId
    )
  }

  return updated ?? {
    key: module.id,
    name: module.name,
    description: module.description,
    category: module.category,
    layerKey: module.layerKey,
    rootRoute: module.routePath,
    status: module.status ?? 'active',
    scopes: module.scopes,
    featureFlag: module.featureFlag,
    requiredPermissions: module.permissions,
    moduleRoles: roleDefinitions,
    orgPolicy: policy,
    effectivePolicy: policy,
    tenantEnabled: true,
    orgEnabled: policy.mode !== 'blocked',
    effectiveEnabled: policy.mode !== 'blocked'
  }
})

