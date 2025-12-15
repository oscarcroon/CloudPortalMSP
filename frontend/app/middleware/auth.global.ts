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

  // Check tenant access for tenant routes
  if (to.path.startsWith('/admin/tenants')) {
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
      const { getEffectiveModulePolicyForOrg } = await import('~~/server/utils/modulePolicy')
      
      const modules = getAllModules()
      const matchingModule = modules.find((m) => to.path.startsWith(m.rootRoute))
      
      if (matchingModule) {
        // Get full module status to check enabled/disabled
        const { getOrganizationModulesStatus } = await import('~~/server/utils/modulePolicy')
        const modules = await getOrganizationModulesStatus(currentOrgId)
        const module = modules.find((m) => m.key === matchingModule.id)
        
        // Block access if module is:
        // 1. Not effectively enabled (inaktiverad)
        // 2. Effectively disabled (avaktiverad eller kommer snart)
        // 3. Disabled at org level (avaktiverad eller kommer snart)
        if (!module || !module.effectiveEnabled || module.effectiveDisabled || module.orgDisabled) {
          return navigateTo('/?error=module-disabled', { replace: true })
        }
      }
    } else if (import.meta.client && auth) {
      // Client-side check - make API call to check module visibility
      const { getAllModules } = await import('~/lib/modules')
      const modules = getAllModules()
      const matchingModule = modules.find((m) => to.path.startsWith(m.rootRoute))
      
      if (matchingModule) {
        try {
          const response = await $fetch(`/api/organizations/${currentOrgId}/modules`)
          const module = (response.modules || []).find((m: any) => m.key === matchingModule.id)
          // Block access if module is:
          // 1. Not effectively enabled (inaktiverad - enabled: false)
          // 2. Effectively disabled (avaktiverad eller kommer snart - disabled: true)
          // 3. Org disabled (avaktiverad eller kommer snart på org-nivå)
          if (!module || !module.effectiveEnabled || module.effectiveDisabled || module.orgDisabled) {
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

