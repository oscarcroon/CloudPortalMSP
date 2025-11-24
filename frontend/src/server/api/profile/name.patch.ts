import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { users } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { requireSession } from '~/server/utils/session'

const nameSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(4, 'Namnet måste vara minst 4 tecken.')
    .max(120, 'Namnet får vara högst 120 tecken.')
    .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, {
      message: 'Ange både för- och efternamn.'
    })
})

export default defineEventHandler(async (event) => {
  const auth = await requireSession(event)
  const db = getDb()

  const payload = nameSchema.safeParse(await readBody(event))
  if (!payload.success) {
    const message = payload.error.issues.map((issue) => issue.message).join(' ')
    throw createError({ statusCode: 400, message })
  }

  await db
    .update(users)
    .set({
      fullName: payload.data.fullName,
      updatedAt: new Date()
    })
    .where(eq(users.id, auth.user.id))

  auth.user.fullName = payload.data.fullName

  return { fullName: payload.data.fullName }
})


