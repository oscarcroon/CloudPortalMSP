import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships, users } from '~~/server/database/schema'
import { requirePermission } from '~~/server/utils/rbac'
import { getModulePermissions, type ModuleId } from '~/constants/modules'
import type { RbacRole } from '~/constants/rbac'
import { getModuleById } from '~/lib/modules'
import { getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'
import { getModuleRoleDefaultsMap } from '~~/server/utils/moduleRoleDefaults'
import { resolveModuleRoleState } from '~~/server/utils/moduleRoleState'
import { getModuleRoleOverridesForModule } from '~~/server/utils/userModuleRoles'
import { getUserModulePermissions } from '~~/server/utils/userModulePermissions'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const moduleId = getRouterParam(event, 'moduleId') as ModuleId

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Missing module ID' })
  }

  // Require org:manage permission to view user module permissions
  await requirePermission(event, 'org:manage', orgId)

  const moduleDefinition = getModuleById(moduleId)
  if (!moduleDefinition) {
    throw createError({
      statusCode: 400,
      message: `Invalid module ID: ${moduleId}`
    })
  }

  const db = getDb()

  // Get all memberships for this organization
  const memberships = await db
    .select({
      userId: organizationMemberships.userId,
      role: organizationMemberships.role,
      status: organizationMemberships.status,
      user: {
        id: users.id,
        email: users.email,
        fullName: users.fullName
      }
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(organizationMemberships.userId, users.id))
    .where(
      and(
        eq(organizationMemberships.organizationId, orgId),
        eq(organizationMemberships.status, 'active')
      )
    )

  // Get module permissions
  const modulePermissions = getModulePermissions(moduleId)
  const moduleRoleOverrides = await getModuleRoleOverridesForModule(orgId, moduleId)
  const modulePolicy = await getEffectiveModulePolicyForOrg(orgId, moduleId)
  const moduleRoleDefaults = await getModuleRoleDefaultsMap(moduleId)

  const moduleRolePermissionMap = new Map<string, Set<string>>(
    (moduleDefinition.roles ?? []).map((role) => [
      role.key,
      new Set(role.requiredPermissions ?? [])
    ])
  )

  const allowedPermissions = new Set<string>(
    modulePolicy.mode === 'blocked'
      ? []
      : modulePolicy.allowedPermissions && modulePolicy.allowedPermissions.length > 0
        ? modulePolicy.allowedPermissions
        : modulePermissions
  )

  // For each user, get their role permissions and user-specific denials
  const usersWithPermissions = await Promise.all(
    memberships.map(async (membership) => {
      // Modulroller -> modulrättigheter (manifest)
      const defaultRoles = moduleRoleDefaults.get(membership.role as RbacRole) ?? []
      const overrides = moduleRoleOverrides.get(membership.userId)
      const roleState = resolveModuleRoleState({
        defaultRoles,
        overrides,
        allowedRoles: modulePolicy.allowedRoles
      })

      const inheritedPermissions = new Set<string>()
      for (const roleKey of roleState.effectiveRoles) {
        const perms = moduleRolePermissionMap.get(roleKey)
        if (perms) {
          perms.forEach((perm) => inheritedPermissions.add(perm))
        }
      }

      const overridesResult = await getUserModulePermissions(orgId, membership.userId, moduleId)
      const grantSet = new Set(overridesResult?.grants ?? [])
      const denySet = new Set(overridesResult?.denies ?? [])

      const basePermissions = Array.from(inheritedPermissions).filter((perm) =>
        allowedPermissions.has(perm)
      )

      // Effektiva rättigheter = arv + grants - denies (deny vinner)
      const effective = new Set(basePermissions)
      for (const perm of grantSet) {
        if (allowedPermissions.has(perm)) {
          effective.add(perm)
        }
      }
      for (const perm of denySet) {
        effective.delete(perm)
      }

      return {
        userId: membership.userId,
        email: membership.user.email,
        fullName: membership.user.fullName,
        role: membership.role,
        rolePermissions: basePermissions,
        deniedPermissions: Array.from(denySet),
        grantedPermissions: Array.from(grantSet).filter((perm) => allowedPermissions.has(perm)),
        effectivePermissions: Array.from(effective),
        moduleRoles: roleState.effectiveRoles,
        moduleRoleDefaults: roleState.defaultRoles,
        moduleRoleGrants: roleState.grantOverrides,
        moduleRoleDenies: roleState.denyOverrides,
        moduleRoleSource: roleState.source
      }
    })
  )

  return {
    organizationId: orgId,
    moduleId,
    visibilityMode: moduleDefinition.visibilityMode ?? 'everyone',
    roleDefinitions: moduleDefinition.roles ?? [],
    allowedRoles: modulePolicy.allowedRoles,
    allowedRolesSource: modulePolicy.allowedRolesSource,
    allowedPermissions: Array.from(allowedPermissions),
    allowedPermissionsSource: modulePolicy.allowedPermissionsSource,
    users: usersWithPermissions
  }
})

