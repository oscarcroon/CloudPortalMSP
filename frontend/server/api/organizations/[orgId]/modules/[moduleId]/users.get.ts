import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships, users } from '~~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getUserModulePermissions } from '~~/server/utils/userModulePermissions'
import { getModulePermissions } from '~/constants/modules'
import { hasPermission } from '~~/server/utils/rbac'
import type { ModuleId } from '~/constants/modules'
import type { RbacPermission, RbacRole } from '~/constants/rbac'
import { getModuleById } from '~/lib/modules'
import { getModuleRoleOverridesForModule } from '~~/server/utils/userModuleRoles'
import { getModuleRoleDefaultsMap } from '~~/server/utils/moduleRoleDefaults'
import { resolveModuleRoleState } from '~~/server/utils/moduleRoleState'
import { getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'

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

  // For each user, get their role permissions and user-specific denials
  const usersWithPermissions = await Promise.all(
    memberships.map(async (membership) => {
      // Get permissions from role
      const rolePermissions = modulePermissions.filter((perm) =>
        hasPermission(membership.role, perm)
      )

      // Get user-specific denied permissions
      const userDenials = await getUserModulePermissions(orgId, membership.userId, moduleId)
      const deniedPermissions = userDenials
        ? Object.keys(userDenials).filter((perm) => userDenials[perm] === true)
        : []

      // Calculate effective permissions (role permissions minus denied)
      const effectivePermissions = rolePermissions.filter(
        (perm) => !deniedPermissions.includes(perm)
      )

      const defaultRoles = moduleRoleDefaults.get(membership.role as RbacRole) ?? []
      const overrides = moduleRoleOverrides.get(membership.userId)
      const roleState = resolveModuleRoleState({
        defaultRoles,
        overrides,
        allowedRoles: modulePolicy.allowedRoles
      })

      return {
        userId: membership.userId,
        email: membership.user.email,
        fullName: membership.user.fullName,
        role: membership.role,
        rolePermissions,
        deniedPermissions,
        effectivePermissions,
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
    users: usersWithPermissions
  }
})

