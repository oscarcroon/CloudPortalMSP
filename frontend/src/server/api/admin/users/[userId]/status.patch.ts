import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { users } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { requireSuperAdmin } from '~/server/utils/rbac'
import { assertAnotherSuperAdminWillRemain } from '../helpers'

const statusSchema = z.object({
  status: z.enum(['active', 'disabled'])
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'Saknar användar-id.' })
  }
  const payload = statusSchema.parse(await readBody(event))
  const db = getDb()

  await assertAnotherSuperAdminWillRemain(userId)

  await db
    .update(users)
    .set({
      status: payload.status,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))

  return { success: true }
})


