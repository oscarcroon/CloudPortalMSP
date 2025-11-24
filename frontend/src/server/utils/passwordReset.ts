import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { users } from '../database/schema'
import { getDb } from './db'
import { createInviteToken, sha256 } from './crypto'
import { describeEmailSendError } from './emailTest'
import { sendPasswordResetEmail } from './mailer'
import { PASSWORD_RESET_TOKEN_TTL_MS } from './password'

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailDeliveryError'
  }
}

export const triggerPasswordReset = async (userId: string, email: string) => {
  const db = getDb()
  const token = createInviteToken()
  const tokenHash = sha256(token)
  const expiresAt = Date.now() + PASSWORD_RESET_TOKEN_TTL_MS

  const result = await db
    .update(users)
    .set({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
      forcePasswordReset: 1
    })
    .where(eq(users.id, userId))

  if (result.rowsAffected === 0) {
    throw createError({ statusCode: 404, message: 'Användaren kunde inte uppdateras.' })
  }

  try {
    await sendPasswordResetEmail({
      to: email,
      token,
      expiresAt
    })
  } catch (error) {
    throw new EmailDeliveryError(describeEmailSendError(error))
  }
}

