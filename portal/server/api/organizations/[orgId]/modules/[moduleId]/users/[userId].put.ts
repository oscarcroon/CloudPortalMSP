import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships } from '~~/server/database/schema'
import { getModulePermissions, type ModuleId } from '~/constants/modules'
import type { RbacPermission, RbacRole } from '~/constants/rbac'
import { getModuleById } from '~/lib/modules'
import { getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'
import { getModuleRoleDefaultsMap } from '~~/server/utils/moduleRoleDefaults'
import { setModuleRoleOverridesForModule } from '~~/server/utils/userModuleRoles'
import {
  getUserModulePermissions,
  normalizePermissionOverrides,
  setUserModulePermissions
} from '~~/server/utils/userModulePermissions'
import { requirePermission } from '~~/server/utils/rbac'

interface PermissionOverrideBody {
  grants?: string[]
  denies?: string[]
  [key: string]: unknown
}

interface RequestBody {
  permissionOverrides?: PermissionOverrideBody | Record<string, boolean>
  deniedPermissions?: Record<string, boolean> // legacy fallback
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
  if (!body) {
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
  const allowedPermissions = new Set<RbacPermission | string>(
    modulePolicy.mode === 'blocked'
      ? []
      : modulePolicy.allowedPermissions && modulePolicy.allowedPermissions.length > 0
        ? modulePolicy.allowedPermissions
        : modulePermissions
  )

  if (modulePolicy.mode === 'blocked') {
    throw createError({
      statusCode: 403,
      message: 'Module is blocked by policy on this organization.'
    })
  }

  const overrides = normalizePermissionOverrides(
    body.permissionOverrides ?? body.deniedPermissions ?? {}
  ) ?? { grants: [], denies: [] }

  const allOverrideKeys = [...overrides.grants, ...overrides.denies]
  const invalidPermissions = allOverrideKeys.filter(
    (perm) => !modulePermissions.includes(perm as RbacPermission)
  )

  if (invalidPermissions.length > 0) {
    throw createError({
      statusCode: 400,
      message: `Invalid permissions for module ${moduleId}: ${invalidPermissions.join(', ')}`
    })
  }

  const notAllowed = allOverrideKeys.filter((perm) => !allowedPermissions.has(perm))
  if (notAllowed.length > 0) {
    throw createError({
      statusCode: 403,
      message: `Module policy restricts permissions: ${notAllowed.join(', ')}`
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

  // Update user module permissions (grants/denies)
  await setUserModulePermissions(orgId, userId, moduleId, overrides, allowedPermissions)

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
  const normalized = updated ?? { grants: [], denies: [] }
  const legacyDenied: Record<string, boolean> = {}
  for (const perm of normalized.denies) {
    legacyDenied[perm] = true
  }

  return {
    organizationId: orgId,
    moduleId,
    userId,
    permissionOverrides: normalized,
    deniedPermissions: legacyDenied,
    moduleRoles: moduleRoles ?? []
  }
})

