import type { ModuleRoleKey } from '~/constants/modules'
import type { ModuleRoleOverrideSet } from './userModuleRoles'

export type ModuleRoleStateSource = 'custom' | 'rbac' | 'none'

export interface EffectiveModuleRoleState {
  defaultRoles: ModuleRoleKey[]
  grantOverrides: ModuleRoleKey[]
  denyOverrides: ModuleRoleKey[]
  effectiveRoles: ModuleRoleKey[]
  source: ModuleRoleStateSource
}

export const resolveModuleRoleState = ({
  defaultRoles,
  overrides,
  allowedRoles
}: {
  defaultRoles: ModuleRoleKey[]
  overrides?: ModuleRoleOverrideSet
  allowedRoles: ModuleRoleKey[] | null
}): EffectiveModuleRoleState => {
  const allowedSet = allowedRoles ? new Set(allowedRoles) : null
  const normalizedDefaults = allowedSet
    ? defaultRoles.filter((role) => allowedSet.has(role))
    : [...defaultRoles]

  const grants = overrides ? Array.from(overrides.grants) : []
  const denies = overrides ? Array.from(overrides.denies) : []

  const normalizedGrants = allowedSet ? grants.filter((role) => allowedSet.has(role)) : grants
  const normalizedDenies = denies.filter((role) => normalizedDefaults.includes(role))

  const effective = new Set<ModuleRoleKey>(normalizedDefaults)
  for (const deny of normalizedDenies) {
    effective.delete(deny)
  }
  for (const grant of normalizedGrants) {
    effective.add(grant)
  }

  const source: ModuleRoleStateSource =
    normalizedGrants.length > 0 || normalizedDenies.length > 0
      ? 'custom'
      : normalizedDefaults.length > 0
      ? 'rbac'
      : 'none'

  return {
    defaultRoles: normalizedDefaults,
    grantOverrides: normalizedGrants,
    denyOverrides: normalizedDenies,
    effectiveRoles: Array.from(effective),
    source
  }
}


