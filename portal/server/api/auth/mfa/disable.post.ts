import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ensureAuthState } from '../../../utils/session'
import { getDb } from '../../../utils/db'
import { users } from '../../../database/schema'
import { verifyTotpCode } from '../../../utils/totp'
import { logSecurityEvent } from '../../../utils/audit'

const schema = z.object({
  code: z.string().min(6).max(6)
})

/**
 * POST /api/auth/mfa/disable
 * Disables MFA after verifying a valid TOTP code.
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const body = schema.parse(await readBody(event))
  const db = getDb()

  const [user] = await db
    .select({
      isMfaEnabled: users.isMfaEnabled,
      mfaTotpSecret: users.mfaTotpSecret
    })
    .from(users)
    .where(eq(users.id, auth.user.id))

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  if (!user.isMfaEnabled || !user.mfaTotpSecret) {
    throw createError({ statusCode: 400, message: 'MFA is not enabled' })
  }

  // Verify the code before disabling
  const valid = verifyTotpCode(user.mfaTotpSecret, body.code)
  if (!valid) {
    throw createError({ statusCode: 400, message: 'Invalid verification code' })
  }

  // Disable MFA
  await db
    .update(users)
    .set({
      isMfaEnabled: false,
      mfaTotpSecret: null,
      mfaBackupCodes: null
    })
    .where(eq(users.id, auth.user.id))

  await logSecurityEvent(event, 'MFA_DISABLED', {
    userId: auth.user.id
  }, { userId: auth.user.id })

  return { success: true }
})
