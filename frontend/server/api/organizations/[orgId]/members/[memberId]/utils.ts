import { getOrganizationModulesStatus } from '~~/server/utils/modulePolicy'
import { getModuleRoleOverridesForMember } from '~~/server/utils/userModuleRoles'
import { createModuleRoleDefaultResolver } from '~~/server/utils/moduleRoleDefaults'
import { resolveModuleRoleState } from '~~/server/utils/moduleRoleState'
import type { ModuleRoleDefinition, ModuleRoleKey } from '~/constants/modules'
import type { PolicyMode } from '~/types/modules'
import type { RbacRole } from '~/constants/rbac'

export interface MemberModuleRoleEntry {
  moduleId: string
  name: string
  description: string
  roleDefinitions: ModuleRoleDefinition[]
  allowedRoles: ModuleRoleKey[] | null
  allowedRolesSource: 'module-default' | 'distributor' | 'provider' | 'organization' | null
  defaultRoles: ModuleRoleKey[]
  grantOverrides: ModuleRoleKey[]
  denyOverrides: ModuleRoleKey[]
  effectiveRoles: ModuleRoleKey[]
  editable: boolean
  roleSource: 'custom' | 'rbac' | 'none'
  policyMode: PolicyMode
}

export const getMemberModuleRolePayload = async (
  organizationId: string,
  userId: string,
  memberRole: RbacRole
): Promise<MemberModuleRoleEntry[]> => {
  const modules = await getOrganizationModulesStatus(organizationId)
  const modulesWithRoles = modules.filter(
    (module) =>
      module.effectiveEnabled &&
      Array.isArray(module.moduleRoles) &&
      module.moduleRoles.length > 0
  )
  const overridesByModule = await getModuleRoleOverridesForMember(organizationId, userId)
  const resolveDefaultRoles = createModuleRoleDefaultResolver()

  return Promise.all(
    modulesWithRoles.map(async (module) => {
      const policy = module.effectivePolicy
      const moduleRoles = module.moduleRoles || []

      const allowedRoles =
        policy.mode === 'allowlist' ? policy.allowedRoles ?? [] : null

      const blocked =
        policy.mode === 'blocked' || (policy.mode === 'allowlist' && allowedRoles?.length === 0)

      const rawDefaults = await resolveDefaultRoles(module.key as any, memberRole)
      const defaultRoles =
        policy.mode === 'default-closed'
          ? []
          : allowedRoles
          ? rawDefaults.filter((role) => allowedRoles.includes(role))
          : rawDefaults

      const overrideSet = overridesByModule.get(module.key as any)
      const state = resolveModuleRoleState({
        defaultRoles,
        overrides: overrideSet,
        allowedRoles
      })

      return {
        moduleId: module.key,
        name: module.name,
        description: module.description,
        roleDefinitions: moduleRoles,
        allowedRoles,
        allowedRolesSource: 'organization',
        defaultRoles: state.defaultRoles,
        grantOverrides: state.grantOverrides,
        denyOverrides: state.denyOverrides,
        effectiveRoles: state.effectiveRoles,
        editable: !blocked,
        roleSource: state.source,
        policyMode: policy.mode
      }
    })
  )
}

