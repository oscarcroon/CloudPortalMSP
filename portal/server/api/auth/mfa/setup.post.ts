import { createError, defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { ensureAuthState } from '../../../utils/session'
import { getDb } from '../../../utils/db'
import { users } from '../../../database/schema'
import { generateTotpSecret } from '../../../utils/totp'

/**
 * POST /api/auth/mfa/setup
 * Generates a new TOTP secret and QR code for the user.
 * Does NOT enable MFA yet — the user must confirm with a valid code first.
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()
  const [user] = await db
    .select({ isMfaEnabled: users.isMfaEnabled })
    .from(users)
    .where(eq(users.id, auth.user.id))

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  if (user.isMfaEnabled) {
    throw createError({ statusCode: 409, message: 'MFA is already enabled' })
  }

  const { secret, qrCodeDataUrl } = await generateTotpSecret(auth.user.email)

  // Store the secret temporarily (not yet enabled)
  await db
    .update(users)
    .set({ mfaTotpSecret: secret })
    .where(eq(users.id, auth.user.id))

  return {
    qrCodeDataUrl,
    secret
  }
})
