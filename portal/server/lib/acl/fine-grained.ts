export type ResourceRole = 'viewer' | 'editor' | 'admin'

export interface ResourceAccessResult {
  canView: boolean
  canEdit: boolean
  canManage: boolean
  effectiveRole: ResourceRole | null
}

export const RESOURCE_ROLE_ORDER: ResourceRole[] = ['viewer', 'editor', 'admin']

export function maxResourceRole(roles: ResourceRole[]): ResourceRole | null {
  if (!roles.length) return null
  let current: ResourceRole = 'viewer'
  for (const role of roles) {
    if (RESOURCE_ROLE_ORDER.indexOf(role) > RESOURCE_ROLE_ORDER.indexOf(current)) {
      current = role
    }
  }
  return current
}

export function clampResourceRole(resourceRole: ResourceRole, moduleRole: ResourceRole): ResourceRole {
  return RESOURCE_ROLE_ORDER.indexOf(resourceRole) <= RESOURCE_ROLE_ORDER.indexOf(moduleRole)
    ? resourceRole
    : moduleRole
}



