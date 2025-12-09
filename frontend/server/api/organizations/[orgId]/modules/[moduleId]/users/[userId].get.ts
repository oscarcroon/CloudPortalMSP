import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { organizationMemberships, users } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requirePermission, hasPermission } from '~~/server/utils/rbac'
import { getModulePermissions, type ModuleId } from '~/constants/modules'
import type { RbacPermission, RbacRole } from '~/constants/rbac'
import { getModuleById } from '~/lib/modules'
import { getModuleRoleOverridesForModule } from '~~/server/utils/userModuleRoles'
import { getModuleRoleDefaultsMap } from '~~/server/utils/moduleRoleDefaults'
import { resolveModuleRoleState } from '~~/server/utils/moduleRoleState'
import { getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'
import { getUserModulePermissions } from '~~/server/utils/userModulePermissions'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const moduleId = getRouterParam(event, 'moduleId') as ModuleId
  const userId = getRouterParam(event, 'userId')

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Missing module ID' })
  }
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Missing user ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const moduleDefinition = getModuleById(moduleId)
  if (!moduleDefinition) {
    throw createError({
      statusCode: 400,
      message: `Invalid module ID: ${moduleId}`
    })
  }

  const db = getDb()
  const [membership] = await db
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
    .where(and(eq(organizationMemberships.organizationId, orgId), eq(organizationMemberships.userId, userId)))

  if (!membership) {
    throw createError({ statusCode: 404, message: 'User not found in organization' })
  }

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
    perms?.forEach((perm) => inheritedPermissions.add(perm))
  }

  const userOverrides = await getUserModulePermissions(orgId, membership.userId, moduleId)
  const grantSet = new Set(userOverrides?.grants ?? [])
  const denySet = new Set(userOverrides?.denies ?? [])

  const rolePermissions = modulePermissions.filter((perm) =>
    hasPermission(membership.role, perm as RbacPermission)
  )

  const permissions = modulePermissions.map((key) => {
    const allowed = allowedPermissions.has(key)
    const inherited = inheritedPermissions.has(key)
    const state = denySet.has(key) ? 'deny' : grantSet.has(key) ? 'grant' : 'inherit'
    const effective =
      state === 'deny'
        ? false
        : state === 'grant'
          ? true
          : inherited

    return {
      key,
      allowed,
      inherited,
      effective,
      state
    }
  })

  return {
    organizationId: orgId,
    moduleId,
    userId: membership.userId,
    role: membership.role,
    allowedPermissions: Array.from(allowedPermissions),
    policyMode: modulePolicy.mode,
    rolePermissions,
    grants: Array.from(grantSet),
    denies: Array.from(denySet),
    permissions
  }
})


