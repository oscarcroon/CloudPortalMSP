import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ensureAuthState } from '../../../utils/session'
import { getDb } from '../../../utils/db'
import { users } from '../../../database/schema'
import { verifyTotpCode, generateBackupCodes, hashBackupCode } from '../../../utils/totp'
import { logSecurityEvent } from '../../../utils/audit'

const schema = z.object({
  code: z.string().min(6).max(6)
})

/**
 * POST /api/auth/mfa/confirm
 * Verifies the TOTP code against the stored (pending) secret and enables MFA.
 * Returns backup codes on success.
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

  if (user.isMfaEnabled) {
    throw createError({ statusCode: 409, message: 'MFA is already enabled' })
  }

  if (!user.mfaTotpSecret) {
    throw createError({ statusCode: 400, message: 'No pending MFA setup. Call /api/auth/mfa/setup first.' })
  }

  // Verify the code
  const valid = verifyTotpCode(user.mfaTotpSecret, body.code)
  if (!valid) {
    throw createError({ statusCode: 400, message: 'Invalid verification code' })
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes()
  const hashedCodes = await Promise.all(backupCodes.map(hashBackupCode))

  // Enable MFA
  await db
    .update(users)
    .set({
      isMfaEnabled: true,
      mfaBackupCodes: JSON.stringify(hashedCodes)
    })
    .where(eq(users.id, auth.user.id))

  await logSecurityEvent(event, 'MFA_ENABLED', {
    userId: auth.user.id,
    method: 'totp'
  }, { userId: auth.user.id })

  return {
    success: true,
    backupCodes
  }
})
