import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireTenantPermission } from '~/server/utils/rbac'
import { getTenantModulePolicy } from '~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import type { ModuleId } from '~/constants/modules'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  // Require tenant:manage permission
  await requireTenantPermission(event, 'tenants:manage', tenantId)

  // Get all modules
  const modules = getAllModules()

  // Get policies for each module
  const policies = await Promise.all(
    modules.map(async (module) => {
      const policy = await getTenantModulePolicy(tenantId, module.id)
      // If policy is null, default is enabled: true
      return {
        moduleId: module.id,
        module: {
          id: module.id,
          name: module.name,
          description: module.description,
          category: module.category,
          permissions: module.permissions,
          icon: module.icon
        },
        enabled: policy === null ? true : policy.enabled,
        disabled: policy === null ? false : policy.disabled,
        permissionOverrides: policy?.permissionOverrides ?? {}
      }
    })
  )

  return {
    tenantId,
    policies
  }
})

