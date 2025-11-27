import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~/server/utils/rbac'
import { isModuleEnabledForOrg, getEffectiveModulePolicyForOrg } from '~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import { getModulePermissions } from '~/constants/modules'
import { hasPermission } from '~/server/utils/rbac'
import { ensureAuthState } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  // Require basic org access
  await requirePermission(event, 'org:read', orgId)

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  // Get all modules
  const modules = getAllModules()

  // Filter modules based on:
  // 1. Module is enabled for organization (if disabled, it's hidden completely)
  // 2. User has at least one required permission
  // 3. Include disabled status for modules that are enabled but deactivated
  const visibleModules = await Promise.all(
    modules.map(async (module) => {
      // Get full policy to check both enabled and disabled
      const policy = await getEffectiveModulePolicyForOrg(orgId, module.id)
      
      // If module is not enabled, don't show it at all
      if (!policy.enabled) {
        return null
      }

      // Check if user has at least one permission for this module
      const modulePermissions = getModulePermissions(module.id)
      const userRole = auth.orgRoles[orgId]
      const hasAnyPermission =
        auth.user.isSuperAdmin ||
        (userRole && modulePermissions.some((perm) => hasPermission(userRole, perm)))

      if (!hasAnyPermission) {
        return null
      }

      return {
        id: module.id,
        name: module.name,
        description: module.description,
        category: module.category,
        routePath: module.routePath,
        icon: module.icon,
        badge: module.badge || undefined,
        disabled: policy.disabled || false
      }
    })
  )

  return {
    organizationId: orgId,
    modules: visibleModules.filter((m) => m !== null)
  }
})

