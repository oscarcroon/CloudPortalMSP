import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships } from '~~/server/database/schema'
import { getModuleById } from '~/lib/modules'
import type { ModuleId, ModuleRoleKey } from '~/constants/modules'
import type { RbacRole } from '~/constants/rbac'
import { setModuleRoleOverridesForModule } from '~~/server/utils/userModuleRoles'
import { getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'
import { createModuleRoleDefaultResolver } from '~~/server/utils/moduleRoleDefaults'
import { getMemberModuleRolePayload } from './utils'

const bodySchema = z.object({
  modules: z
    .array(
      z.object({
        moduleId: z.string(),
        roleKeys: z.array(z.string())
      })
    )
    .min(1)
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const memberId = getRouterParam(event, 'memberId')

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  if (!memberId) {
    throw createError({ statusCode: 400, message: 'Missing member ID' })
  }

  await requirePermission(event, 'users:manage', orgId)

  const body = bodySchema.parse(await readBody(event))

  const db = getDb()
  const [membership] = await db
    .select({
      id: organizationMemberships.id,
      organizationId: organizationMemberships.organizationId,
      userId: organizationMemberships.userId,
      role: organizationMemberships.role
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.id, memberId))

  if (!membership || membership.organizationId !== orgId) {
    throw createError({ statusCode: 404, message: 'Member not found in this organization' })
  }

  if (!membership.userId) {
    throw createError({ statusCode: 400, message: 'Member is not linked to a user account yet' })
  }

  const userId = membership.userId

  const resolveDefaultRoles = createModuleRoleDefaultResolver()

  for (const entry of body.modules) {
    await updateModuleRolesForMember(
      orgId,
      userId,
      membership.role,
      entry.moduleId as ModuleId,
      entry.roleKeys,
      resolveDefaultRoles
    )
  }

  // Refresh payload
  const payload = await getMemberModuleRolePayload(orgId, userId, membership.role)

  return {
    organizationId: orgId,
    memberId: membership.id,
    userId,
    modules: payload
  }
})

const updateModuleRolesForMember = async (
  organizationId: string,
  userId: string,
  memberRole: RbacRole,
  moduleId: ModuleId,
  roleKeys: ModuleRoleKey[],
  resolveDefaultRoles: ReturnType<typeof createModuleRoleDefaultResolver>
) => {
  const module = getModuleById(moduleId)

  if (!module || !module.roles || module.roles.length === 0) {
    if (roleKeys.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Module ${moduleId} does not support module-specific roles`
      })
    }
    return
  }

  const policy = await getEffectiveModulePolicyForOrg(organizationId, moduleId)

  if (Array.isArray(policy.allowedRoles) && policy.allowedRoles.length === 0) {
    throw createError({
      statusCode: 403,
      message: 'Module roles are blocked for this module at a higher level'
    })
  }

  const validRoleKeys = new Set(module.roles.map((role) => role.key))
  const invalidRoles = roleKeys.filter((role) => !validRoleKeys.has(role))
  if (invalidRoles.length > 0) {
    throw createError({
      statusCode: 400,
      message: `Invalid module roles for ${moduleId}: ${invalidRoles.join(', ')}`
    })
  }

  if (Array.isArray(policy.allowedRoles) && policy.allowedRoles.length > 0) {
    const allowedSet = new Set(policy.allowedRoles)
    const disallowed = roleKeys.filter((role) => !allowedSet.has(role))
    if (disallowed.length > 0) {
      throw createError({
        statusCode: 403,
        message: `Module roles are restricted by policy: ${disallowed.join(', ')}`
      })
    }
  }

  const defaultRoles = await resolveDefaultRoles(moduleId, memberRole)
  const desiredSet = new Set(roleKeys)
  const grants = Array.from(desiredSet).filter((role) => !defaultRoles.includes(role))
  const denies = defaultRoles.filter((role) => !desiredSet.has(role))

  await setModuleRoleOverridesForModule({
    organizationId,
    userId,
    moduleId,
    grantKeys: grants,
    denyKeys: denies
  })
}

