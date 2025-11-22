import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { users } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { hashPassword, sha256 } from '../../../utils/crypto'
import { createSession } from '../../../utils/session'
import { passwordSchema } from '../../../utils/password'

const resetSchema = z.object({
  token: z.string().min(10).max(256),
  password: passwordSchema
})

export default defineEventHandler(async (event) => {
  const payload = resetSchema.parse(await readBody(event))
  const tokenHash = sha256(payload.token)
  const db = getDb()

  const [user] = await db
    .select({
      id: users.id,
      passwordResetTokenHash: users.passwordResetTokenHash,
      passwordResetExpiresAt: users.passwordResetExpiresAt
    })
    .from(users)
    .where(eq(users.passwordResetTokenHash, tokenHash))

  if (
    !user ||
    !user.passwordResetTokenHash ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt < Date.now()
  ) {
    throw createError({
      statusCode: 400,
      message: 'Återställningslänken är ogiltig eller har gått ut.'
    })
  }

  const newHash = await hashPassword(payload.password)

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      forcePasswordReset: 0
    })
    .where(eq(users.id, user.id))

  const auth = await createSession(event, user.id)
  return { success: true, auth }
})


