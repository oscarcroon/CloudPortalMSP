import { useRequestEvent } from '#imports'
import { type RbacPermission, type RbacRole, rolePermissionMap } from '~/constants/rbac'
import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(async (to) => {
  const event = import.meta.server ? useRequestEvent() : null
  const serverAuth = event?.context.auth ?? null
  const auth = import.meta.client ? useAuth() : null

  if (import.meta.client && auth && !auth.initialized.value && !auth.loading.value) {
    await auth.bootstrap()
  }

  const isPublic = Boolean(to.meta.public)
  const isAuthenticated = import.meta.server
    ? Boolean(serverAuth)
    : Boolean(auth?.state.value.data)

  if (!isAuthenticated && !isPublic && to.path !== '/login') {
    return navigateTo(
      {
        path: '/login',
        query: { redirect: to.fullPath }
      },
      { replace: true }
    )
  }

  if (isAuthenticated && to.path === '/login') {
    return navigateTo('/', { replace: true })
  }

  if (!isAuthenticated) {
    return
  }

  const requiresSuperAdmin = Boolean((to.meta as Record<string, unknown>)?.superAdmin)
  const isSuperAdmin = import.meta.server
    ? Boolean(serverAuth?.user.isSuperAdmin)
    : Boolean(auth?.state.value.data?.user.isSuperAdmin)
  const currentOrgId = import.meta.server
    ? serverAuth?.currentOrgId ?? null
    : auth?.state.value.data?.currentOrgId ?? null
  const isSettingsRoot = to.path === '/settings'
  const isSettingsSubRoute = to.path.startsWith('/settings') && !isSettingsRoot
  const isSettingsRoute = isSettingsRoot || isSettingsSubRoute
  const hasOrgManagePermission = (() => {
    if (!currentOrgId) return false
    const role = import.meta.server
      ? serverAuth?.orgRoles?.[currentOrgId]
      : auth?.state.value.data?.orgRoles?.[currentOrgId]
    return role ? rolePermissionMap[role]?.includes('org:manage') : false
  })()
  
  if (isSettingsRoute && !currentOrgId) {
    return navigateTo('/?error=no-org', { replace: true })
  }

  if (isSettingsRoute && !isSuperAdmin && !hasOrgManagePermission) {
    return navigateTo('/?error=missing-permission', { replace: true })
  }

  // Check tenant access for tenant-admin routes
  if (to.path.startsWith('/tenant-admin')) {
    const hasTenantAccess =
      isSuperAdmin ||
      (import.meta.server
        ? Object.keys(serverAuth?.tenantRoles ?? {}).length > 0
        : Object.keys(auth?.state.value.data?.tenantRoles ?? {}).length > 0)

    if (!hasTenantAccess) {
      return navigateTo('/settings?error=missing-permission')
    }

    if (requiresSuperAdmin && !isSuperAdmin) {
      return navigateTo('/settings?error=missing-permission')
    }
  } else if (requiresSuperAdmin && !isSuperAdmin) {
    return navigateTo('/settings?error=missing-permission')
  }

  // Check module policy for module routes
  if (currentOrgId) {
    if (import.meta.server && event) {
      // Server-side check
      const { getAllModules } = await import('~/lib/modules')
      
      const modules = getAllModules()
      const matchingModule = modules.find((m) => to.path.startsWith(m.rootRoute))
      
      if (matchingModule) {
        // Get full module status to check enabled/disabled
        const { getOrganizationModulesStatus } = await import('~~/server/utils/modulePolicy')
        const { resolveEffectiveModulePermissions } = await import('~~/server/utils/modulePermissions')
        
        const orgModules = await getOrganizationModulesStatus(currentOrgId)
        const module = orgModules.find((m) => m.key === matchingModule.id)
        
        // Block if module is not enabled at org/tenant/global level
        if (!module || !module.effectiveEnabled) {
          return navigateTo('/?error=module-disabled', { replace: true })
        }
        
        // Block if module is disabled (coming-soon/deactivated)
        if (module.effectiveDisabled || module.orgDisabled) {
          return navigateTo('/?error=module-disabled', { replace: true })
        }
        
        // Check user permissions for this module (unless superadmin)
        if (!isSuperAdmin && serverAuth?.user.id) {
          const { effectivePermissions } = await resolveEffectiveModulePermissions({
            orgId: currentOrgId,
            moduleKey: matchingModule.id,
            userId: serverAuth.user.id
          })
          
          // Check if user has at least view/read/access permission
          const hasReadPermission = Array.from(effectivePermissions).some((perm) =>
            perm.startsWith(`${matchingModule.id}:`) &&
            (perm.includes(':view') || perm.includes(':read') || perm.includes(':access'))
          )
          
          if (!hasReadPermission) {
            return navigateTo('/?error=missing-permission', { replace: true })
          }
        }
      }
    } else if (import.meta.client && auth) {
      // Client-side check - make API call to check module visibility
      const { getAllModules } = await import('~/lib/modules')
      const modules = getAllModules()
      const matchingModule = modules.find((m) => to.path.startsWith(m.rootRoute))
      
      if (matchingModule) {
        try {
          const response = await $fetch(`/api/organizations/${currentOrgId}/modules/visible`)
          // /modules/visible returns 'id' not 'key', so check both for compatibility
          const module = (response.modules || []).find((m: any) => 
            m.id === matchingModule.id || m.key === matchingModule.id
          )
          // If module is not in the visible list, user doesn't have permission
          // Also block if module is disabled (coming-soon/deactivated)
          if (!module) {
            return navigateTo('/?error=missing-permission', { replace: true })
          }
          if (module.disabled || module.effectiveDisabled) {
            return navigateTo('/?error=module-disabled', { replace: true })
          }
        } catch (error) {
          // If API call fails, allow access (fail open for better UX)
          console.warn('Failed to check module visibility:', error)
        }
      }
    }
  }

  const requiredPermissions = (to.meta.permissions as RbacPermission[]) ?? []
  if (!requiredPermissions.length || isSuperAdmin) {
    return
  }

  const role: RbacRole | undefined = currentOrgId
    ? import.meta.server
      ? serverAuth?.orgRoles[currentOrgId]
      : auth?.state.value.data?.orgRoles[currentOrgId]
    : undefined

  if (!role) {
    return navigateTo('/settings?error=no-org')
  }

  const hasAll = requiredPermissions.every((permission) =>
    rolePermissionMap[role]?.includes(permission)
  )
  if (!hasAll) {
    return navigateTo('/settings?error=missing-permission')
  }
})

