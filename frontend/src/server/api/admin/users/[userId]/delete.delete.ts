import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { users } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { requireSuperAdmin } from '~/server/utils/rbac'
import { assertAnotherSuperAdminWillRemain } from '../helpers'
import { logUserAction } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await requireSuperAdmin(event)
  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Saknar användar-id.' })
  }
  const db = getDb()

  await assertAnotherSuperAdminWillRemain(userId)

  // Get user info before deletion for audit log
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  
  await db.delete(users).where(eq(users.id, userId))

  // Log audit event
  await logUserAction(event, 'USER_DELETED', {
    targetUserId: userId,
    targetUserEmail: user?.email
  }, userId)

  return { success: true }
})


