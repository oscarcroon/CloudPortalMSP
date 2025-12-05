import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { setTenantModulePolicy, getTenantModulePolicy } from '~~/server/utils/modulePolicy'
import { getModuleById } from '~/lib/modules'
import type { ModuleId } from '~/constants/modules'
import type { ModulePermissionOverrides } from '~~/server/utils/modulePolicy'
import { logTenantAction } from '~~/server/utils/audit'

const bodySchema = z.object({
  moduleId: z.string(),
  enabled: z.boolean().optional(),
  disabled: z.boolean().optional(),
  permissionOverrides: z.record(z.boolean()).optional(),
  allowedRoles: z.array(z.string()).nullable().optional()
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  const body = bodySchema.parse(await readBody(event))
  const { moduleId, enabled, disabled, permissionOverrides, allowedRoles } = body

  // Require tenant:manage permission
  await requireTenantPermission(event, 'tenants:manage', tenantId)

  // Validate module ID
  const module = getModuleById(moduleId as ModuleId)
  if (!module) {
    throw createError({
      statusCode: 400,
      message: `Invalid module ID: ${moduleId}`
    })
  }

  // If only permissionOverrides is provided (not enabled/disabled), keep the existing state
  // This allows toggling permissions without affecting module enabled/disabled state
  let finalEnabled = enabled
  let finalDisabled = disabled
  let finalPermissionOverrides = permissionOverrides
  
  if (enabled === undefined && disabled === undefined && permissionOverrides !== undefined) {
    // Only permission overrides changed, get current state
    const currentPolicy = await getTenantModulePolicy(tenantId, moduleId as ModuleId)
    finalEnabled = currentPolicy?.enabled ?? true
    finalDisabled = currentPolicy?.disabled ?? false
  } else if ((enabled !== undefined || disabled !== undefined) && permissionOverrides === undefined) {
    // Only enabled/disabled changed, keep existing permission overrides
    const currentPolicy = await getTenantModulePolicy(tenantId, moduleId as ModuleId)
    finalPermissionOverrides = currentPolicy?.permissionOverrides
    if (enabled === undefined) {
      finalEnabled = currentPolicy?.enabled ?? true
    }
    if (disabled === undefined) {
      finalDisabled = currentPolicy?.disabled ?? false
    }
  } else {
    // Both or neither provided
    finalEnabled = enabled ?? true
    finalDisabled = disabled ?? false
  }

  // Get old policy for audit log
  const oldPolicy = await getTenantModulePolicy(tenantId, moduleId as ModuleId)
  const oldEnabled = oldPolicy?.enabled ?? true
  const oldDisabled = oldPolicy?.disabled ?? false

  if (allowedRoles !== undefined) {
    if (!module.roles || module.roles.length === 0) {
      if (allowedRoles && allowedRoles.length > 0) {
        throw createError({
          statusCode: 400,
          message: `Module ${moduleId} does not define module-specific roles`
        })
      }
    } else if (allowedRoles) {
      const validRoleKeys = new Set(module.roles.map((role) => role.key))
      const invalidRoles = allowedRoles.filter((role) => !validRoleKeys.has(role))
      if (invalidRoles.length > 0) {
        throw createError({
          statusCode: 400,
          message: `Invalid module roles for ${moduleId}: ${invalidRoles.join(', ')}`
        })
      }
    }
  }

  // Update policy
  await setTenantModulePolicy(
    tenantId,
    moduleId as ModuleId,
    Boolean(finalEnabled),
    finalPermissionOverrides as ModulePermissionOverrides | undefined,
    finalDisabled,
    allowedRoles === undefined ? undefined : allowedRoles
  )

  // Log audit event
  if (finalEnabled !== oldEnabled || finalDisabled !== oldDisabled) {
    await logTenantAction(event, finalEnabled ? 'MODULE_ENABLED' : 'MODULE_DISABLED', {
      moduleId,
      oldEnabled,
      newEnabled: finalEnabled,
      oldDisabled,
      newDisabled: finalDisabled
    }, tenantId)
  }

  // Return updated policy
  const updatedPolicy = await getTenantModulePolicy(tenantId, moduleId as ModuleId)
  const tenantEnabled =
    updatedPolicy === null ? true : typeof updatedPolicy.enabled === 'boolean'
      ? updatedPolicy.enabled
      : updatedPolicy.enabled === 1
  const tenantDisabled =
    updatedPolicy === null ? false : typeof updatedPolicy.disabled === 'boolean'
      ? updatedPolicy.disabled
      : updatedPolicy.disabled === 1

  return {
    key: module.id,
    moduleId: module.id,
    name: module.name,
    description: module.description,
    category: module.category,
    layerKey: module.layerKey,
    rootRoute: module.routePath,
    scopes: module.scopes,
    status: module.status ?? 'active',
    featureFlag: module.featureFlag,
    requiredPermissions: module.permissions,
    tenantEnabled,
    tenantDisabled,
    effectiveEnabled: tenantEnabled,
    permissionOverrides: updatedPolicy?.permissionOverrides ?? {},
    allowedRoles: updatedPolicy?.allowedRoles ?? null
  }
})

