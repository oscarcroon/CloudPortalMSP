import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { users } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { hashPassword, sha256 } from '../../../utils/crypto'
import { createSession } from '../../../utils/session'
import { passwordSchema } from '../../../utils/password'
import { formatZodErrorAsList } from '../../../utils/errors'
import { logUserAction } from '../../../utils/audit'

const resetSchema = z.object({
  token: z.string().min(10).max(256),
  password: passwordSchema
})

export default defineEventHandler(async (event) => {
  let payload
  try {
    payload = resetSchema.parse(await readBody(event))
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: formatZodErrorAsList(error).join('. '),
        data: {
          errors: formatZodErrorAsList(error)
        }
      })
    }
    throw error
  }
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

  if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
    throw createError({
      statusCode: 400,
      message: 'Återställningslänken är ogiltig eller har gått ut.',
      data: {
        errors: ['Återställningslänken är ogiltig eller har gått ut.']
      }
    })
  }

  // Convert to milliseconds - Drizzle returns Date objects for timestamp_ms columns
  const expiresAtMs =
    user.passwordResetExpiresAt instanceof Date
      ? user.passwordResetExpiresAt.getTime()
      : typeof user.passwordResetExpiresAt === 'number'
        ? user.passwordResetExpiresAt
        : Number(user.passwordResetExpiresAt)

  const now = Date.now()
  if (isNaN(expiresAtMs) || expiresAtMs < now) {
    throw createError({
      statusCode: 400,
      message: 'Återställningslänken är ogiltig eller har gått ut.',
      data: {
        errors: ['Återställningslänken är ogiltig eller har gått ut.']
      }
    })
  }

  const newHash = await hashPassword(payload.password)

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      forcePasswordReset: false
    })
    .where(eq(users.id, user.id))

  const auth = await createSession(event, user.id)
  
  // Log audit event
  await logUserAction(event, 'PASSWORD_RESET_COMPLETED', {}, user.id)
  
  return { success: true, auth }
})


