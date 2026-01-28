import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { normalizeEmail } from '../../../utils/crypto'
import { ensureAuthState } from '../../../utils/session'

const checkEmailSchema = z.object({
  email: z.string().min(1).refine(
    (val) => {
      // Use same regex as frontend for consistency
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(val.trim())
    },
    { message: 'Invalid email format' }
  )
})

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }
  const payload = checkEmailSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  const normalizedEmail = normalizeEmail(payload.email)
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      status: users.status
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (!user) {
    return { exists: false }
  }

  return {
    exists: true,
    user: {
      email: user.email,
      fullName: user.fullName,
      status: user.status
    }
  }
})
