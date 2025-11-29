import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { requirePermission, requireSuperAdmin } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizationMemberships } from '~~/server/database/schema'
import { getMemberModuleRolePayload } from './[memberId]/utils'
import type { RbacRole } from '~/constants/rbac'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  // Allow super admins or users with users:manage permission for the organization
  try {
    // Try to check if user is super admin first
    await requireSuperAdmin(event)
    // If we get here, user is super admin, so we can proceed
  } catch (error) {
    // Not a super admin, check for users:manage permission
    await requirePermission(event, 'users:manage', orgId)
  }

  const db = getDb()
  
  // Get all members in the organization with their userId and role
  const members = await db
    .select({
      userId: organizationMemberships.userId,
      role: organizationMemberships.role
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.organizationId, orgId))

  // Check each member to see if they have custom overrides
  const userIdsWithOverrides: string[] = []

  for (const member of members) {
    if (!member.userId) continue

    try {
      // Get module role payload for this member to check for custom overrides
      const modules = await getMemberModuleRolePayload(
        orgId,
        member.userId,
        member.role as RbacRole
      )

      // Check if any module has custom overrides (roleSource === 'custom')
      const hasCustomOverrides = modules.some((entry) => entry.roleSource === 'custom')
      
      if (hasCustomOverrides) {
        userIdsWithOverrides.push(member.userId)
      }
    } catch (error) {
      // If we can't check this member, skip them (don't add to list)
      console.error(`[module-role-overrides] Failed to check member ${member.userId}:`, error)
    }
  }

  return {
    organizationId: orgId,
    userIds: userIdsWithOverrides
  }
})


