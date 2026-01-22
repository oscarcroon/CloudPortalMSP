import { resolveEffectiveModulePermissions } from '~~/server/utils/modulePermissions'
import type { WindowsDnsModuleRights } from './types'
import { buildModuleRights } from './permissions-map'

/**
 * Get Windows DNS module access rights for a user in an organization.
 */
export const getWindowsDnsModuleAccessForUser = async (
  orgId: string,
  userId: string
): Promise<WindowsDnsModuleRights> => {
  const perms = await resolveEffectiveModulePermissions({
    orgId,
    moduleKey: 'windows-dns',
    userId
  })
  return buildModuleRights(perms.effectivePermissions)
}

/**
 * Check if user has any Windows DNS access in the organization.
 */
export const canAccessWindowsDns = async (
  orgId: string,
  userId: string
): Promise<boolean> => {
  const rights = await getWindowsDnsModuleAccessForUser(orgId, userId)
  return rights.canView
}

