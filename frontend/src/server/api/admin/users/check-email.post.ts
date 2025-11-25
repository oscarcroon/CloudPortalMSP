import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { normalizeEmail } from '../../../utils/crypto'
import { requireSuperAdmin } from '../../../utils/rbac'

const checkEmailSchema = z.object({
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const payload = checkEmailSchema.parse(await readBody(event))
  const db = getDb()
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

