import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireTenantPermission } from '~~/server/utils/rbac'
import {
  getTenantModulePolicy,
  getTenantModulesStatus,
  setTenantModulePolicy
} from '~~/server/utils/modulePolicy'
import { getModuleById } from '~/lib/modules'
import type { ModuleId } from '~/constants/modules'
import type { ModulePolicy } from '~/types/modules'
import { logTenantAction } from '~~/server/utils/audit'

const bodySchema = z.object({
  moduleKey: z.string(),
  mode: z.enum(['inherit', 'default-closed', 'allowlist', 'blocked']),
  allowedRoles: z.array(z.string()).optional(),
  allowedPermissions: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  disabled: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  const body = bodySchema.parse(await readBody(event))
  const { moduleKey, mode, allowedRoles, allowedPermissions, enabled, disabled } = body

  await requireTenantPermission(event, 'tenants:manage', tenantId)

  const module = getModuleById(moduleKey as ModuleId)
  if (!module) {
    throw createError({ statusCode: 400, message: `Invalid module key: ${moduleKey}` })
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const validRoleKeys = new Set((module.moduleRoles ?? module.roles ?? []).map((role) => role.key))
    const invalid = allowedRoles.filter((role) => !validRoleKeys.has(role))
    if (invalid.length) {
      throw createError({
        statusCode: 400,
        message: `Invalid module roles for ${moduleKey}: ${invalid.join(', ')}`
      })
    }
  }

  const allRoleKeys = (module.moduleRoles ?? module.roles ?? []).map((role) => role.key)
  const allPermissionKeys = module.requiredPermissions ?? []

  const normalizedAllowedRoles =
    mode === 'allowlist'
      ? Array.from(
          new Set((allowedRoles && allowedRoles.length ? allowedRoles : allRoleKeys).filter(Boolean))
        )
      : []
  const normalizedAllowedPermissions =
    mode === 'allowlist'
      ? Array.from(
          new Set(
            (allowedPermissions && allowedPermissions.length ? allowedPermissions : allPermissionKeys).filter(Boolean)
          )
        )
      : []

  const previousPolicy = await getTenantModulePolicy(tenantId, moduleKey as ModuleId)

  const policy: ModulePolicy = {
    moduleKey,
    mode,
    allowedRoles: normalizedAllowedRoles,
    allowedPermissions: normalizedAllowedPermissions,
    // enabled/disabled flags påverkar synlighet på tenant-nivå
    enabled: enabled ?? true,
    disabled: disabled ?? false,
    permissionOverrides:
      mode === 'allowlist'
        ? Object.fromEntries(normalizedAllowedPermissions.map((key) => [key, true]))
        : undefined
  } as any

  await setTenantModulePolicy(tenantId, moduleKey as ModuleId, policy)

  const updatedModules = await getTenantModulesStatus(tenantId)
  const updated = updatedModules.find((item) => item.key === moduleKey)

  if (previousPolicy?.mode !== policy.mode || previousPolicy?.allowedRoles !== policy.allowedRoles) {
    await logTenantAction(
      event,
      policy.mode === 'blocked' ? 'MODULE_DISABLED' : 'MODULE_ENABLED',
      {
        moduleKey,
        previousMode: previousPolicy?.mode ?? 'inherit',
        newMode: policy.mode,
        previousAllowedRoles: previousPolicy?.allowedRoles ?? [],
        newAllowedRoles: policy.allowedRoles
      },
      tenantId
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
    moduleRoles: module.moduleRoles ?? module.roles ?? [],
    tenantPolicy: policy,
    effectivePolicy: policy,
    tenantEnabled: policy.mode !== 'blocked',
    orgEnabled: policy.mode !== 'blocked',
    effectiveEnabled: policy.mode !== 'blocked'
  }
})

