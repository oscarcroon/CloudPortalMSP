import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships, users } from '~~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getUserModulePermissions } from '~~/server/utils/userModulePermissions'
import { getModulePermissions } from '~/constants/modules'
import { hasPermission } from '~~/server/utils/rbac'
import type { ModuleId } from '~/constants/modules'
import type { RbacPermission } from '~/constants/rbac'

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

      return {
        userId: membership.userId,
        email: membership.user.email,
        fullName: membership.user.fullName,
        role: membership.role,
        rolePermissions,
        deniedPermissions,
        effectivePermissions
      }
    })
  )

  return {
    organizationId: orgId,
    moduleId,
    users: usersWithPermissions
  }
})

