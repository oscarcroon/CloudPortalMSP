import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~~/server/utils/rbac'
import { getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import { ensureAuthState } from '~~/server/utils/session'

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
  // 1. Module is not blocked for organization (blocked → hidden)
  // 2. Include disabled status if blocked
  const visibleModules = await Promise.all(
    modules.map(async (module) => {
      // Get full policy to check both enabled and disabled
      const policy = await getEffectiveModulePolicyForOrg(orgId, module.id)
      
      // If blocked, hide entirely
      if (policy.mode === 'blocked') {
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
        disabled: policy.mode === 'blocked'
      }
    })
  )

  return {
    organizationId: orgId,
    modules: visibleModules.filter((m) => m !== null)
  }
})

