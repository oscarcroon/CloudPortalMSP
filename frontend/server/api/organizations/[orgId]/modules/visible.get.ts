import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~~/server/utils/rbac'
import { isModuleEnabledForOrg, getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import { getModulePermissions } from '~/constants/modules'
import { hasPermission } from '~~/server/utils/rbac'
import type { RbacRole } from '~/constants/rbac'
import { ensureAuthState } from '~~/server/utils/session'
import { getModuleRoleOverridesForMember } from '~~/server/utils/userModuleRoles'
import { createModuleRoleDefaultResolver } from '~~/server/utils/moduleRoleDefaults'
import { resolveModuleRoleState } from '~~/server/utils/moduleRoleState'

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

  const moduleRoleOverrides = await getModuleRoleOverridesForMember(orgId, auth.user.id)
  const resolveDefaultRoles = createModuleRoleDefaultResolver()

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

      const requiresModuleRoles =
        module.visibilityMode === 'moduleRoles' && (module.roles?.length ?? 0) > 0

      if (requiresModuleRoles && !auth.user.isSuperAdmin) {
        const allowedRoles = policy.allowedRoles

        if (Array.isArray(allowedRoles) && allowedRoles.length === 0) {
          return null
        }

        if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
          if (!userRole) {
            return null
          }
          const defaultRoles = await resolveDefaultRoles(module.id, userRole as RbacRole)
          const overrides = moduleRoleOverrides.get(module.id)
          const state = resolveModuleRoleState({
            defaultRoles,
            overrides,
            allowedRoles
          })
          const hasModuleRole = state.effectiveRoles.some((role) => allowedRoles.includes(role))

          if (!hasModuleRole) {
            return null
          }
        }
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

