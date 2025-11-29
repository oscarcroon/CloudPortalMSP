import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { normalizeEmail } from '../../../utils/crypto'
import { ensureAuthState } from '../../../utils/session'

const checkEmailSchema = z.object({
  email: z.string().email()
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
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  return { exists: !!user }
})
