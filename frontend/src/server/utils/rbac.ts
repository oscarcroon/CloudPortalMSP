import { createError, H3Event } from 'h3'
import type { RbacPermission, RbacRole } from '~/constants/rbac'
import { rolePermissionMap } from '~/constants/rbac'
import { ensureAuthState } from './session'

export const hasPermission = (role: RbacRole, permission: RbacPermission) =>
  rolePermissionMap[role]?.includes(permission) ?? false

export const requirePermission = async (
  event: H3Event,
  permission: RbacPermission,
  targetOrgId?: string
) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }
  const orgId = targetOrgId ?? auth.currentOrgId
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Select an organization' })
  }

  if (auth.user.isSuperAdmin) {
    return { auth, role: 'owner', orgId }
  }

  const role = auth.orgRoles[orgId]
  if (!role || !hasPermission(role, permission)) {
    throw createError({
      statusCode: 403,
      message: `Missing permission ${permission} for organization ${orgId}`
    })
  }
  return { auth, role, orgId }
}

export const requireSuperAdmin = async (event: H3Event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.user.isSuperAdmin) {
    throw createError({ statusCode: 403, message: 'Super admin required' })
  }
  return auth
}

