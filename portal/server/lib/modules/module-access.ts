import { and, eq } from 'drizzle-orm'
import type { ModuleKey, ModuleRoleKeyMap } from '@/app/generated/rbac-types'
import {
  memberModuleRoleOverrides,
  moduleRoleDefaults,
  organizationMemberships,
  modules as modulesTable
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { getOrganizationModulesStatus } from '~~/server/utils/modulePolicy'

export interface ModuleAccess<TModule extends ModuleKey = ModuleKey> {
  hasAccess: boolean
  roles: ModuleRoleKeyMap[TModule][]
}

type ModuleRoleOverrideSet<RoleKey extends string = string> = {
  grants: Set<RoleKey>
  denies: Set<RoleKey>
}

const emptyOverrideSet = <RoleKey extends string = string>(): ModuleRoleOverrideSet<RoleKey> => ({
  grants: new Set<RoleKey>(),
  denies: new Set<RoleKey>()
})

const mergeDefaultAndOverrides = <RoleKey extends string = string>(
  defaults: RoleKey[],
  overrides: ModuleRoleOverrideSet<RoleKey>
): RoleKey[] => {
  const effective = new Set(defaults)
  for (const deny of overrides.denies) {
    effective.delete(deny)
  }
  for (const grant of overrides.grants) {
    effective.add(grant)
  }
  return Array.from(effective)
}

async function getOrgMemberWithRole(orgId: string, userId: string) {
  const db = getDb()
  const [row] = await db
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(
      and(eq(organizationMemberships.organizationId, orgId), eq(organizationMemberships.userId, userId))
    )

  return row ?? null
}

async function getMemberModuleRoleOverrides(
  orgId: string,
  userId: string,
  moduleKey: ModuleKey
): Promise<ModuleRoleOverrideSet> {
  const db = getDb()
  const rows = await db
    .select({
      roleKey: memberModuleRoleOverrides.roleKey,
      effect: memberModuleRoleOverrides.effect
    })
    .from(memberModuleRoleOverrides)
    .where(
      and(
        eq(memberModuleRoleOverrides.organizationId, orgId),
        eq(memberModuleRoleOverrides.userId, userId),
        eq(memberModuleRoleOverrides.moduleId, moduleKey)
      )
    )

  const result = emptyOverrideSet()
  for (const row of rows) {
    if (row.effect === 'grant') {
      result.grants.add(row.roleKey)
    } else {
      result.denies.add(row.roleKey)
    }
  }
  return result
}

export async function getModuleAccessForUser<TModule extends ModuleKey = ModuleKey>(
  orgId: string,
  userId: string,
  moduleKey: TModule
): Promise<ModuleAccess<TModule>> {
  const db = getDb()

  const member = await getOrgMemberWithRole(orgId, userId)
  if (!member) {
    return { hasAccess: false, roles: [] }
  }

  // Global enable check
  const [moduleRow] = await db
    .select({ enabled: modulesTable.enabled })
    .from(modulesTable)
    .where(eq(modulesTable.key, moduleKey))
  if (!moduleRow?.enabled) {
    return { hasAccess: false, roles: [] }
  }

  // Org-level enable check (module policy)
  const orgModules = await getOrganizationModulesStatus(orgId)
  const orgModule = orgModules.find((m) => m.key === moduleKey)
  if (!orgModule?.effectiveEnabled) {
    return { hasAccess: false, roles: [] }
  }

  const appRoleKey = member.role

  const defaultRows = await db
    .select({
      moduleRoleKey: moduleRoleDefaults.moduleRoleKey
    })
    .from(moduleRoleDefaults)
    .where(
      and(
        eq(moduleRoleDefaults.moduleKey, moduleKey),
        eq(moduleRoleDefaults.appRoleKey, appRoleKey)
      )
    )

  const defaultModuleRoles = defaultRows.map((r) => r.moduleRoleKey as ModuleRoleKeyMap[TModule])
  const overrides = await getMemberModuleRoleOverrides(orgId, userId, moduleKey)
  const effectiveRoles = mergeDefaultAndOverrides(defaultModuleRoles, overrides)

  if (effectiveRoles.length === 0) {
    return { hasAccess: false, roles: [] }
  }

  return { hasAccess: true, roles: effectiveRoles }
}


