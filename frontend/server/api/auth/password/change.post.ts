import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { users } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { hashPassword, verifyPassword } from '../../../utils/crypto'
import { requireSession, createSession } from '../../../utils/session'
import { passwordSchema } from '../../../utils/password'
import { logUserAction } from '../../../utils/audit'

const changeSchema = z.object({
  currentPassword: z.string().min(8, 'Nuvarande lösenord krävs.'),
  newPassword: passwordSchema
})

export default defineEventHandler(async (event) => {
  const auth = await requireSession(event)
  const payload = changeSchema.parse(await readBody(event))
  const db = getDb()

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(eq(users.id, auth.user.id))

  if (!user || !user.passwordHash) {
    throw createError({ statusCode: 400, message: 'Användaren saknar lösenord att uppdatera.' })
  }

  const valid = await verifyPassword(payload.currentPassword, user.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 400, message: 'Fel nuvarande lösenord.' })
  }

  const newHash = await hashPassword(payload.newPassword)

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      forcePasswordReset: 0
    })
    .where(eq(users.id, user.id))

  await createSession(event, user.id)

  // Log audit event
  await logUserAction(event, 'PASSWORD_CHANGED', {}, user.id)

  return { success: true }
})


