import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireTenantPermission } from '~/server/utils/rbac'
import { setTenantModulePolicy, getTenantModulePolicy } from '~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import type { ModuleId } from '~/constants/modules'
import type { ModulePermissionOverrides } from '~/server/utils/modulePolicy'

const bodySchema = z.object({
  moduleId: z.string(),
  enabled: z.boolean().optional(),
  disabled: z.boolean().optional(),
  permissionOverrides: z.record(z.boolean()).optional()
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  const body = bodySchema.parse(await readBody(event))
  const { moduleId, enabled, disabled, permissionOverrides } = body

  // Require tenant:manage permission
  await requireTenantPermission(event, 'tenants:manage', tenantId)

  // Validate module ID
  const modules = getAllModules()
  const module = modules.find((m) => m.id === moduleId)
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

  // Update policy
  await setTenantModulePolicy(
    tenantId,
    moduleId as ModuleId,
    finalEnabled,
    finalPermissionOverrides as ModulePermissionOverrides | undefined,
    finalDisabled
  )

  // Return updated policy
  const updatedPolicy = await getTenantModulePolicy(tenantId, moduleId as ModuleId)
  
  // If policy is null, it means default enabled (true) and disabled (false)
  // If policy exists, use its values
  const resultEnabled = updatedPolicy === null ? true : updatedPolicy.enabled
  const resultDisabled = updatedPolicy === null ? false : updatedPolicy.disabled
  
  return {
    tenantId,
    moduleId,
    enabled: resultEnabled,
    disabled: resultDisabled,
    permissionOverrides: updatedPolicy?.permissionOverrides ?? {}
  }
})

