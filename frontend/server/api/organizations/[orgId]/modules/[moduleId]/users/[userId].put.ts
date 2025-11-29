import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships, users } from '~~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { setUserModulePermissions, getUserModulePermissions } from '~~/server/utils/userModulePermissions'
import { getModulePermissions } from '~/constants/modules'
import { hasPermission } from '~~/server/utils/rbac'
import type { ModuleId } from '~/constants/modules'
import type { RbacPermission, RbacRole } from '~/constants/rbac'
import { getModuleById } from '~/lib/modules'
import { setModuleRoleOverridesForModule } from '~~/server/utils/userModuleRoles'
import { getModuleRoleDefaultsMap } from '~~/server/utils/moduleRoleDefaults'
import { getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'

interface RequestBody {
  deniedPermissions: Record<string, boolean>
  moduleRoles?: string[]
}

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

  // Require org:manage permission to update user module permissions
  await requirePermission(event, 'org:manage', orgId)

  const body = await readBody<RequestBody>(event)

  if (!body || typeof body.deniedPermissions !== 'object') {
    throw createError({ statusCode: 400, message: 'Invalid request body' })
  }
  const moduleRoles = body.moduleRoles

  const db = getDb()

  // Verify user is a member of the organization
  const [membership] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, orgId),
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, 'active')
      )
    )

  if (!membership) {
    throw createError({ statusCode: 404, message: 'User not found in organization' })
  }

  const moduleDefinition = getModuleById(moduleId)
  if (!moduleDefinition) {
    throw createError({ statusCode: 400, message: `Invalid module ID: ${moduleId}` })
  }
  const modulePolicy = await getEffectiveModulePolicyForOrg(orgId, moduleId)

  // Get module permissions to validate
  const modulePermissions = getModulePermissions(moduleId)

  // Validate that all denied permissions belong to this module
  const invalidPermissions = Object.keys(body.deniedPermissions).filter(
    (perm) => !modulePermissions.includes(perm as RbacPermission)
  )

  if (invalidPermissions.length > 0) {
    throw createError({
      statusCode: 400,
      message: `Invalid permissions for module ${moduleId}: ${invalidPermissions.join(', ')}`
    })
  }

  // Validate that we can only deny permissions the user's role has
  // (we can't expand permissions, only restrict)
  const userRole = membership.role
  const rolePermissions = modulePermissions.filter((perm) => hasPermission(userRole, perm))

  const deniedPermissions = Object.keys(body.deniedPermissions).filter(
    (perm) => body.deniedPermissions[perm] === true
  )

  const invalidDenials = deniedPermissions.filter(
    (perm) => !rolePermissions.includes(perm as RbacPermission)
  )

  if (invalidDenials.length > 0) {
    throw createError({
      statusCode: 400,
      message: `Cannot deny permissions that user's role doesn't have: ${invalidDenials.join(', ')}`
    })
  }

  if (moduleRoles !== undefined) {
    if (!moduleDefinition.roles || moduleDefinition.roles.length === 0) {
      if (moduleRoles.length > 0) {
        throw createError({
          statusCode: 400,
          message: `Module ${moduleId} does not define module-specific roles`
        })
      }
    } else if (moduleRoles.length > 0) {
      const validRoleKeys = new Set(moduleDefinition.roles.map((role) => role.key))
      const invalidRoles = moduleRoles.filter((role) => !validRoleKeys.has(role))
      if (invalidRoles.length > 0) {
        throw createError({
          statusCode: 400,
          message: `Invalid module roles for ${moduleId}: ${invalidRoles.join(', ')}`
        })
      }
    }

    if (Array.isArray(modulePolicy.allowedRoles) && modulePolicy.allowedRoles.length === 0) {
      throw createError({
        statusCode: 403,
        message: 'Module roles are blocked for this module at a higher level'
      })
    }

    if (Array.isArray(modulePolicy.allowedRoles) && modulePolicy.allowedRoles.length > 0) {
      const allowedSet = new Set(modulePolicy.allowedRoles)
      const disallowed = moduleRoles.filter((role) => !allowedSet.has(role))
      if (disallowed.length > 0) {
        throw createError({
          statusCode: 403,
          message: `Module roles are restricted by policy: ${disallowed.join(', ')}`
        })
      }
    }
  }

  // Build the denied permissions object (only include permissions that are explicitly denied)
  const deniedPermissionsObj: Record<string, boolean> = {}
  for (const perm of deniedPermissions) {
    deniedPermissionsObj[perm] = true
  }

  // Update user module permissions
  await setUserModulePermissions(orgId, userId, moduleId, deniedPermissionsObj)

  if (moduleRoles !== undefined) {
    const moduleRoleDefaults = await getModuleRoleDefaultsMap(moduleId)
    const defaultRoles = moduleRoleDefaults.get(membership.role as RbacRole) ?? []
    const desiredSet = new Set(moduleRoles)
    const grants = Array.from(desiredSet).filter((role) => !defaultRoles.includes(role))
    const denies = defaultRoles.filter((role) => !desiredSet.has(role))

    await setModuleRoleOverridesForModule({
      organizationId: orgId,
      userId,
      moduleId,
      grantKeys: grants,
      denyKeys: denies
    })
  }

  // Return updated permissions
  const updated = await getUserModulePermissions(orgId, userId, moduleId)
  return {
    organizationId: orgId,
    moduleId,
    userId,
    deniedPermissions: updated || {},
    moduleRoles: moduleRoles ?? []
  }
})

