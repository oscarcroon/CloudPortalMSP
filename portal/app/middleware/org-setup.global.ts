/**
 * Global middleware for organization setup wizard.
 * 
 * Redirects Owner/Admin users to /org-setup when their current organization
 * has setupStatus='pending'. Non-admin users are blocked with a message.
 */
import { rolePermissionMap } from '~/constants/rbac'
import { useAuth } from '~/composables/useAuth'

// Routes that should always be accessible regardless of setup status
const ALLOWED_ROUTES = new Set([
  '/org-setup',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/invite',
  '/logout'
])

// Route prefixes that should always be accessible
const ALLOWED_PREFIXES = [
  '/api/',
  '/_nuxt/',
  '/__nuxt_error'
]

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip on server-side - let auth.global.ts handle initial checks
  if (import.meta.server) {
    return
  }

  // Check if route is in allowed list
  if (ALLOWED_ROUTES.has(to.path)) {
    return
  }

  // Check if route starts with allowed prefix
  if (ALLOWED_PREFIXES.some(prefix => to.path.startsWith(prefix))) {
    return
  }

  const auth = useAuth()

  // Wait for auth to initialize if needed
  if (!auth.initialized.value && !auth.loading.value) {
    await auth.bootstrap()
  }

  // If not authenticated, let auth.global.ts handle it
  if (!auth.state.value.data) {
    return
  }

  const currentOrgId = auth.state.value.data.currentOrgId
  if (!currentOrgId) {
    return
  }

  // Find current organization
  const currentOrg = auth.state.value.data.organizations.find(
    (org) => org.id === currentOrgId
  )

  if (!currentOrg) {
    return
  }

  // Check if setup is pending
  if (currentOrg.setupStatus !== 'pending') {
    return
  }

  // Setup is pending - check user's role
  const userRole = auth.state.value.data.orgRoles[currentOrgId]
  const hasOrgManage = userRole ? rolePermissionMap[userRole]?.includes('org:manage') : false

  if (hasOrgManage) {
    // User can manage org - redirect to setup wizard
    if (to.path !== '/org-setup') {
      return navigateTo('/org-setup', { replace: true })
    }
  } else {
    // User cannot manage org - show blocked message
    // Redirect to a simple "setup pending" page or show error
    if (to.path !== '/org-setup-pending') {
      return navigateTo('/org-setup-pending', { replace: true })
    }
  }
})
