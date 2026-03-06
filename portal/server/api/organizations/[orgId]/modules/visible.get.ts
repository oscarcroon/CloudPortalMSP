import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~~/server/utils/rbac'
import { getOrganizationModulesStatus } from '~~/server/utils/modulePolicy'
import { resolveEffectiveModulePermissions } from '~~/server/utils/modulePermissions'
import { getAllModules } from '~/lib/modules'
import { ensureAuthState } from '~~/server/utils/session'
import type { ModuleId } from '~/constants/modules'

// Cache for permission resolution within a single request
const createPermissionCache = (orgId: string, userId: string) => {
  const cache = new Map<string, Set<string>>()
  
  return async (moduleKey: ModuleId): Promise<Set<string>> => {
    if (cache.has(moduleKey)) {
      return cache.get(moduleKey)!
    }
    
    const result = await resolveEffectiveModulePermissions({
      orgId,
      moduleKey,
      userId
    })
    cache.set(moduleKey, result.effectivePermissions)
    return result.effectivePermissions
  }
}

/**
 * Check if user has at least a "read" permission for this module.
 * Read permissions typically end with :view, :read, or :access.
 */
const hasReadPermission = (permissions: Set<string>, moduleKey: string): boolean => {
  for (const perm of permissions) {
    if (
      perm.startsWith(`${moduleKey}:`) &&
      (perm.includes(':view') || perm.includes(':read') || perm.includes(':access'))
    ) {
      return true
    }
  }
  return false
}

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

  // Get all modules with their policy status (batch query)
  const modulesStatus = await getOrganizationModulesStatus(orgId)
  const moduleStatusMap = new Map(modulesStatus.map(m => [m.key, m]))

  // Get all modules from registry
  const modules = getAllModules()

  // Create permission cache for this request to avoid N+1
  const getPermissions = createPermissionCache(orgId, auth.user.id)

  // Filter modules based on:
  // 1. Module is not blocked for organization (effectiveEnabled)
  // 2. User has at least read permission (least privilege)
  const visibleModulesPromises = modules.map(async (module) => {
    const status = moduleStatusMap.get(module.id)
    
    // If blocked or not enabled, hide entirely
    if (!status?.effectiveEnabled || status?.effectivePolicy?.mode === 'blocked') {
      return null
    }

    // Build module response with all needed fields
    const buildModuleResponse = () => ({
      id: module.id,
      name: module.name,
      description: module.description,
      descriptionKey: module.descriptionKey,
      category: module.category,
      routePath: module.routePath,
      icon: module.icon,
      badge: module.badge || undefined,
      disabled: status?.effectiveDisabled ?? false,
      effectiveEnabled: status?.effectiveEnabled ?? true,
      effectiveDisabled: status?.effectiveDisabled ?? false,
      comingSoonMessage: status?.comingSoonMessage ?? null
    })

    // Superadmins see all enabled modules
    if (auth.user.isSuperAdmin) {
      return buildModuleResponse()
    }

    // Check if user has at least read permission for this module
    const permissions = await getPermissions(module.id as ModuleId)
    
    if (!hasReadPermission(permissions, module.id)) {
      return null // No read permission = module is not visible
    }

    return buildModuleResponse()
  })

  const visibleModules = await Promise.all(visibleModulesPromises)

  return {
    organizationId: orgId,
    modules: visibleModules.filter((m) => m !== null)
  }
})

