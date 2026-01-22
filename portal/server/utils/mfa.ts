import { createError, H3Event } from 'h3'
import { eq, and, gt } from 'drizzle-orm'
import { getDb } from './db'
import { mfaSessions, users, organizationAuthSettings, tenantAuthSettings, organizations, tenants } from '../database/schema'
import { ensureAuthState } from './session'
import { createId } from '@paralleldrive/cuid2'

export interface MfaVerificationResult {
  success: boolean
  requiresMfa: boolean
  mfaSessionId?: string
  error?: string
}

const MFA_SESSION_TTL = 60 * 60 * 1000 // 1 hour in milliseconds

/**
 * Check if MFA is required for a sensitive action or context switch
 */
export const checkMfaRequirement = async (
  auth: Awaited<ReturnType<typeof ensureAuthState>>,
  scope: 'tenant' | 'org' | 'global',
  scopeId?: string,
  actionType: 'sensitive' | 'contextSwitch' = 'sensitive'
): Promise<boolean> => {
  if (!auth || auth.user.isSuperAdmin) {
    return false
  }

  const db = getDb()

  if (scope === 'org' && scopeId) {
    const [settings] = await db
      .select()
      .from(organizationAuthSettings)
      .where(eq(organizationAuthSettings.organizationId, scopeId))

    if (settings) {
      if (actionType === 'sensitive') {
        return Boolean(settings.requireMfaOnSensitiveActions)
      } else {
        return Boolean(settings.requireMfaOnContextSwitch)
      }
    }
  }

  if (scope === 'tenant' && scopeId) {
    const [settings] = await db
      .select()
      .from(tenantAuthSettings)
      .where(eq(tenantAuthSettings.tenantId, scopeId))

    if (settings) {
      if (actionType === 'sensitive') {
        return Boolean(settings.requireMfaOnSensitiveActions)
      } else {
        return Boolean(settings.requireMfaOnContextSwitch)
      }
    }
  }

  return false
}

/**
 * Check if user has a valid MFA session for the given scope
 */
export const hasValidMfaSession = async (
  userId: string,
  scope: string
): Promise<boolean> => {
  const db = getDb()
  const now = Date.now()

  const [session] = await db
    .select()
    .from(mfaSessions)
    .where(
      and(
        eq(mfaSessions.userId, userId),
        eq(mfaSessions.scope, scope),
        gt(mfaSessions.expiresAt, new Date(now))
      )
    )
    .limit(1)

  return Boolean(session)
}

/**
 * Create a new MFA session after successful verification
 */
export const createMfaSession = async (
  userId: string,
  scope: string
): Promise<string> => {
  const db = getDb()
  const expiresAt = Date.now() + MFA_SESSION_TTL

  // Delete any existing sessions for this scope
  await db
    .delete(mfaSessions)
    .where(
      and(
        eq(mfaSessions.userId, userId),
        eq(mfaSessions.scope, scope)
      )
    )

  // Create new session
  const sessionId = createId()
  await db.insert(mfaSessions).values({
    id: sessionId,
    userId,
    scope,
    expiresAt: new Date(expiresAt)
  })

  return sessionId
}

/**
 * Verify MFA code (TOTP, SMS, email, etc.)
 * This is a placeholder - implement actual MFA verification based on your setup
 */
export const verifyMfaCode = async (
  userId: string,
  code: string,
  method: 'totp' | 'sms' | 'email' = 'totp'
): Promise<boolean> => {
  const db = getDb()
  const [user] = await db
    .select({ isMfaEnabled: users.isMfaEnabled })
    .from(users)
    .where(eq(users.id, userId))

  if (!user || !user.isMfaEnabled) {
    return false
  }

  // TODO: Implement actual MFA verification
  // For now, this is a placeholder that always returns false
  // You'll need to integrate with your MFA provider (TOTP, SMS gateway, etc.)
  
  // Example structure:
  // if (method === 'totp') {
  //   return await verifyTotpCode(userId, code)
  // } else if (method === 'sms') {
  //   return await verifySmsCode(userId, code)
  // } else if (method === 'email') {
  //   return await verifyEmailCode(userId, code)
  // }

  return false
}

/**
 * Require MFA for a sensitive action or context switch
 */
export const requireMfa = async (
  event: H3Event,
  scope: 'tenant' | 'org' | 'global',
  scopeId?: string,
  actionType: 'sensitive' | 'contextSwitch' = 'sensitive'
): Promise<MfaVerificationResult> => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const scopeString = scope === 'global' ? 'global' : `${scope}:${scopeId}`

  // Check if MFA is required
  const requiresMfa = await checkMfaRequirement(auth, scope, scopeId, actionType)
  if (!requiresMfa) {
    return { success: true, requiresMfa: false }
  }

  // Check if user already has a valid MFA session
  const hasSession = await hasValidMfaSession(auth.user.id, scopeString)
  if (hasSession) {
    return { success: true, requiresMfa: true }
  }

  // MFA required but no valid session
  return {
    success: false,
    requiresMfa: true,
    error: 'MFA_REQUIRED'
  }
}

/**
 * Verify MFA and create session
 */
export const verifyAndCreateMfaSession = async (
  event: H3Event,
  code: string,
  scope: 'tenant' | 'org' | 'global',
  scopeId?: string,
  method: 'totp' | 'sms' | 'email' = 'totp'
): Promise<MfaVerificationResult> => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const scopeString = scope === 'global' ? 'global' : `${scope}:${scopeId}`

  // Verify MFA code
  const isValid = await verifyMfaCode(auth.user.id, code, method)
  if (!isValid) {
    return {
      success: false,
      requiresMfa: true,
      error: 'INVALID_MFA_CODE'
    }
  }

  // Create MFA session
  const sessionId = await createMfaSession(auth.user.id, scopeString)

  return {
    success: true,
    requiresMfa: true,
    mfaSessionId: sessionId
  }
}

