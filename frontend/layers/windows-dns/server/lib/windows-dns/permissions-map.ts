import type { WindowsDnsTokenScope, WindowsDnsModuleRights } from './types'

/**
 * Map portal permissions to WindowsDNS token scopes.
 * This is the core authorization logic: what the user has in the portal
 * determines what scopes the minted token will have.
 */

const PERMISSION_TO_SCOPES: Record<string, WindowsDnsTokenScope[]> = {
  'windows-dns:view': ['zones.read', 'records.read'],
  'windows-dns:zones:create': ['zones.create'],
  'windows-dns:zones:write': ['zones.write'],
  'windows-dns:records:write': ['records.write'],
  'windows-dns:ownership:read': ['ownership.read'],
  'windows-dns:ownership:write': ['ownership.write'],
  'windows-dns:autodiscover:read': ['autodiscover.read']
}

/**
 * Derive WindowsDNS token scopes from a set of portal permissions.
 * Returns a deduplicated, sorted array of scopes.
 */
export const deriveTokenScopes = (portalPermissions: Set<string>): WindowsDnsTokenScope[] => {
  const scopes = new Set<WindowsDnsTokenScope>()

  for (const permission of portalPermissions) {
    const mappedScopes = PERMISSION_TO_SCOPES[permission]
    if (mappedScopes) {
      for (const scope of mappedScopes) {
        scopes.add(scope)
      }
    }
  }

  // Sort for consistent cache key generation
  return Array.from(scopes).sort()
}

/**
 * Build module rights object from portal permissions.
 */
export const buildModuleRights = (portalPermissions: Set<string>): WindowsDnsModuleRights => ({
  roles: [],
  canView: portalPermissions.has('windows-dns:view'),
  canCreateZones: portalPermissions.has('windows-dns:zones:create'),
  canEditZones: portalPermissions.has('windows-dns:zones:write'),
  canEditRecords: portalPermissions.has('windows-dns:records:write'),
  canManageOwnership: portalPermissions.has('windows-dns:ownership:write'),
  canAutodiscover: portalPermissions.has('windows-dns:autodiscover:read'),
  canManageOrgConfig: portalPermissions.has('windows-dns:manage_org_config')
})

/**
 * Check if a set of permissions includes at least one WindowsDNS permission.
 */
export const hasAnyWindowsDnsPermission = (portalPermissions: Set<string>): boolean => {
  for (const key of Object.keys(PERMISSION_TO_SCOPES)) {
    if (portalPermissions.has(key)) return true
  }
  return portalPermissions.has('windows-dns:manage_org_config')
}

