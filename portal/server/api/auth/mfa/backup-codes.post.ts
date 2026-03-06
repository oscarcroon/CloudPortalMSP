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
 * POST /api/auth/mfa/backup-codes
 * Regenerates backup codes after verifying a TOTP code.
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

  if (!user?.isMfaEnabled || !user.mfaTotpSecret) {
    throw createError({ statusCode: 400, message: 'MFA is not enabled' })
  }

  const valid = verifyTotpCode(user.mfaTotpSecret, body.code)
  if (!valid) {
    throw createError({ statusCode: 400, message: 'Invalid verification code' })
  }

  const backupCodes = generateBackupCodes()
  const hashedCodes = await Promise.all(backupCodes.map(hashBackupCode))

  await db
    .update(users)
    .set({ mfaBackupCodes: JSON.stringify(hashedCodes) })
    .where(eq(users.id, auth.user.id))

  await logSecurityEvent(event, 'MFA_BACKUP_CODES_REGENERATED', {
    userId: auth.user.id
  }, { userId: auth.user.id })

  return {
    success: true,
    backupCodes
  }
})
