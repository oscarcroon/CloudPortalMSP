import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { requirePermission, requireSuperAdmin } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { userModulePermissions } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  // Superadmin or org users:manage
  try {
    await requireSuperAdmin(event)
  } catch {
    await requirePermission(event, 'users:manage', orgId)
  }

  const db = getDb()

  const rows = await db
    .select({ userId: userModulePermissions.userId })
    .from(userModulePermissions)
    .where(eq(userModulePermissions.organizationId, orgId))

  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)))

  return {
    organizationId: orgId,
    userIds
  }
})


