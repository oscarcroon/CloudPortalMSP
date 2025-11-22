import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { users } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { requireSuperAdmin } from '~/server/utils/rbac'
import { assertAnotherSuperAdminWillRemain } from '../helpers'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Saknar användar-id.' })
  }
  const db = getDb()

  await assertAnotherSuperAdminWillRemain(userId)

  await db.delete(users).where(eq(users.id, userId))

  return { success: true }
})


