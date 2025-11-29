import { getAllModules } from '~/lib/modules'
import { getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'
import { getModuleRoleOverridesForMember } from '~~/server/utils/userModuleRoles'
import { createModuleRoleDefaultResolver } from '~~/server/utils/moduleRoleDefaults'
import { resolveModuleRoleState } from '~~/server/utils/moduleRoleState'
import type { ModuleRoleDefinition, ModuleRoleKey } from '~/constants/modules'
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
}

export const getMemberModuleRolePayload = async (
  organizationId: string,
  userId: string,
  memberRole: RbacRole
): Promise<MemberModuleRoleEntry[]> => {
  const modulesWithRoles = getAllModules().filter(
    (module) => Array.isArray(module.roles) && module.roles.length > 0
  )

  if (modulesWithRoles.length === 0) {
    return []
  }

  const overridesByModule = await getModuleRoleOverridesForMember(organizationId, userId)
  const resolveDefaultRoles = createModuleRoleDefaultResolver()

  return Promise.all(
    modulesWithRoles.map(async (module) => {
      const policy = await getEffectiveModulePolicyForOrg(organizationId, module.id)
      const blocked = Array.isArray(policy.allowedRoles) && policy.allowedRoles.length === 0
      const defaultRoles = await resolveDefaultRoles(module.id, memberRole)
      const overrideSet = overridesByModule.get(module.id)
      const state = resolveModuleRoleState({
        defaultRoles,
        overrides: overrideSet,
        allowedRoles: policy.allowedRoles
      })

      return {
        moduleId: module.id,
        name: module.name,
        description: module.description,
        roleDefinitions: module.roles || [],
        allowedRoles: policy.allowedRoles,
        allowedRolesSource: policy.allowedRolesSource,
        defaultRoles: state.defaultRoles,
        grantOverrides: state.grantOverrides,
        denyOverrides: state.denyOverrides,
        effectiveRoles: state.effectiveRoles,
        editable: !blocked,
        roleSource: state.source
      }
    })
  )
}

