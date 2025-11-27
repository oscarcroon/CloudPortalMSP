import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/rbac'
import { getEffectiveModulePolicyForOrg } from '~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import type { ModuleId } from '~/constants/modules'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  // Require org:manage permission to view module policies
  await requirePermission(event, 'org:manage', orgId)

  // Get all modules
  const modules = getAllModules()

  // Get effective policies for each module
  const policies = await Promise.all(
    modules.map(async (module) => {
      const policy = await getEffectiveModulePolicyForOrg(orgId, module.id)
      return {
        moduleId: module.id,
        module: {
          id: module.id,
          name: module.name,
          description: module.description,
          category: module.category,
          permissions: module.permissions
        },
        enabled: policy.enabled,
        permissionOverrides: policy.permissionOverrides
      }
    })
  )

  return {
    organizationId: orgId,
    policies
  }
})

