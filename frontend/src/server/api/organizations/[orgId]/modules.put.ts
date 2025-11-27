import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '~/server/utils/rbac'
import { setOrganizationModulePolicy, getEffectiveModulePolicyForOrg } from '~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import type { ModuleId } from '~/constants/modules'
import type { ModulePermissionOverrides } from '~/server/utils/modulePolicy'

const bodySchema = z.object({
  moduleId: z.string(),
  enabled: z.boolean().optional(),
  permissionOverrides: z.record(z.boolean()).optional()
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  const body = bodySchema.parse(await readBody(event))
  const { moduleId, enabled, permissionOverrides } = body

  // Require org:manage permission to update module policies
  await requirePermission(event, 'org:manage', orgId)

  // Validate module ID
  const modules = getAllModules()
  const module = modules.find((m) => m.id === moduleId)
  if (!module) {
    throw createError({
      statusCode: 400,
      message: `Invalid module ID: ${moduleId}`
    })
  }

  // Get current effective policy to ensure we're not expanding permissions
  const currentPolicy = await getEffectiveModulePolicyForOrg(orgId, moduleId as ModuleId)

  // If setting enabled, ensure we're not enabling something that's disabled at tenant level
  if (enabled !== undefined) {
    if (enabled && !currentPolicy.enabled) {
      throw createError({
        statusCode: 403,
        message: 'Cannot enable module that is disabled at tenant level'
      })
    }
  }

  // If setting permission overrides, ensure we're only restricting (not expanding)
  if (permissionOverrides) {
    for (const [permission, value] of Object.entries(permissionOverrides)) {
      if (value === true && currentPolicy.permissionOverrides[permission] === false) {
        throw createError({
          statusCode: 403,
          message: `Cannot enable permission ${permission} that is disabled at tenant level`
        })
      }
    }
  }

  // Update policy
  const finalEnabled = enabled ?? currentPolicy.enabled
  const finalOverrides: ModulePermissionOverrides = {
    ...currentPolicy.permissionOverrides,
    ...(permissionOverrides || {})
  }

  await setOrganizationModulePolicy(orgId, moduleId as ModuleId, finalEnabled, finalOverrides)

  // Return updated policy
  const updatedPolicy = await getEffectiveModulePolicyForOrg(orgId, moduleId as ModuleId)
  return {
    organizationId: orgId,
    moduleId,
    enabled: updatedPolicy.enabled,
    permissionOverrides: updatedPolicy.permissionOverrides
  }
})

