import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { users } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireSession } from '~~/server/utils/session'

const schema = z.object({
  avatarPreference: z.enum(['sso', 'initials'])
})

export default defineEventHandler(async (event) => {
  const auth = await requireSession(event)
  const db = getDb()

  const payload = schema.safeParse(await readBody(event))
  if (!payload.success) {
    const message = payload.error.issues.map((issue) => issue.message).join(' ')
    throw createError({ statusCode: 400, message })
  }

  await db
    .update(users)
    .set({
      avatarPreference: payload.data.avatarPreference,
      updatedAt: new Date()
    })
    .where(eq(users.id, auth.user.id))

  auth.user.avatarPreference = payload.data.avatarPreference

  return { avatarPreference: payload.data.avatarPreference }
})
