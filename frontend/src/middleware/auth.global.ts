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
  if (requiresSuperAdmin && !isSuperAdmin) {
    return navigateTo('/settings?error=missing-permission')
  }

  const requiredPermissions = (to.meta.permissions as RbacPermission[]) ?? []
  if (!requiredPermissions.length || isSuperAdmin) {
    return
  }

  const currentOrgId = import.meta.server
    ? serverAuth?.currentOrgId ?? null
    : auth?.state.value.data?.currentOrgId ?? null
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

