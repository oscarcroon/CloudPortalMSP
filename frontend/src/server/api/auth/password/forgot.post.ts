import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { users } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { normalizeEmail } from '../../../utils/crypto'
import { EmailDeliveryError, triggerPasswordReset } from '../../../utils/passwordReset'

const requestSchema = z.object({
  email: z.string().email()
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default defineEventHandler(async (event) => {
  const payload = requestSchema.parse(await readBody(event))
  const normalizedEmail = normalizeEmail(payload.email)
  const db = getDb()

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))

  if (!user || !user.passwordHash) {
    await sleep(250)
    return { success: true }
  }

  try {
    await triggerPasswordReset(user.id, user.email)
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      throw createError({
        statusCode: 502,
        message: `Kunde inte skicka återställningsmail. ${error.message}`
      })
    }
    console.error('[password-reset] failed to persist token', error)
    throw createError({ statusCode: 500, message: 'Kunde inte initiera återställning.' })
  }

  return { success: true }
})


