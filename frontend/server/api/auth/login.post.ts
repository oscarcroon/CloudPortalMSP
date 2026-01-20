import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { findUserByEmail, touchUserLogin, userRequiresSso } from '../../utils/auth'
import { normalizeEmail, verifyPassword } from '../../utils/crypto'
import { createSession } from '../../utils/session'
import { logSecurityEvent } from '../../utils/audit'
import { getClientIP } from '../../utils/ip'

// ============================================================================
// Login Rate Limiting Configuration
// ============================================================================

// Per-email limits (protects individual accounts)
const EMAIL_MAX_ATTEMPTS = 5
const EMAIL_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const EMAIL_COOLDOWN_STEPS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000] // 5s -> 5min

// Per-IP limits (protects infrastructure from spray attacks)
const IP_MAX_ATTEMPTS = 20
const IP_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

// ============================================================================
// Rate Limiting State (in-memory, single instance)
// ============================================================================

interface LoginAttempt {
  count: number
  firstAttemptAt: number
  lastAttemptAt: number
  cooldownUntil: number
}

const emailAttempts = new Map<string, LoginAttempt>()
const ipAttempts = new Map<string, LoginAttempt>()
const MAX_ENTRIES = 10_000

// Periodic cleanup of expired entries
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, attempt] of emailAttempts) {
    if (now - attempt.firstAttemptAt > EMAIL_WINDOW_MS && attempt.cooldownUntil < now) {
      emailAttempts.delete(key)
    }
  }
  for (const [key, attempt] of ipAttempts) {
    if (now - attempt.firstAttemptAt > IP_WINDOW_MS && attempt.cooldownUntil < now) {
      ipAttempts.delete(key)
    }
  }
}, 60_000)

// Prevent timer from keeping process alive
if (cleanupInterval.unref) {
  cleanupInterval.unref()
}

const trimMap = (map: Map<string, LoginAttempt>) => {
  if (map.size <= MAX_ENTRIES) return
  const overflow = map.size - MAX_ENTRIES
  const it = map.keys()
  for (let i = 0; i < overflow; i++) {
    const key = it.next().value
    if (key) map.delete(key)
  }
}

const getOrCreateAttempt = (map: Map<string, LoginAttempt>, key: string): LoginAttempt => {
  const now = Date.now()
  let attempt = map.get(key)

  if (!attempt || now - attempt.firstAttemptAt > EMAIL_WINDOW_MS) {
    attempt = {
      count: 0,
      firstAttemptAt: now,
      lastAttemptAt: now,
      cooldownUntil: 0
    }
    map.set(key, attempt)
    trimMap(map)
  }

  return attempt
}

const getCooldownDuration = (failedAttempts: number): number => {
  const index = Math.min(failedAttempts - 1, EMAIL_COOLDOWN_STEPS.length - 1)
  return EMAIL_COOLDOWN_STEPS[Math.max(0, index)] || 0
}

// ============================================================================
// Schema
// ============================================================================

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  allowPasswordFallback: z.boolean().optional()
})

// ============================================================================
// Handler
// ============================================================================

export default defineEventHandler(async (event) => {
  const clientIp = getClientIP(event) || 'unknown'
  const now = Date.now()

  // Pre-parse body to get email for rate limiting
  let body: z.infer<typeof loginSchema>
  try {
    body = loginSchema.parse(await readBody(event))
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid request body' })
  }

  const email = normalizeEmail(body.email)

  // ========================================================================
  // Check IP rate limit (before any expensive operations)
  // ========================================================================
  const ipAttempt = getOrCreateAttempt(ipAttempts, clientIp)
  
  if (ipAttempt.count >= IP_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((ipAttempt.firstAttemptAt + IP_WINDOW_MS - now) / 1000)
    
    await logSecurityEvent(event, 'LOGIN_RATE_LIMITED', {
      email,
      reason: 'ip_limit_exceeded',
      ip: clientIp,
      retryAfter
    })

    throw createError({
      statusCode: 429,
      message: 'Too many login attempts. Please try again later.',
      data: { retryAfter: Math.max(1, retryAfter) }
    })
  }

  // ========================================================================
  // Check email rate limit with exponential cooldown
  // ========================================================================
  const emailAttempt = getOrCreateAttempt(emailAttempts, email)

  // Check if in cooldown period
  if (emailAttempt.cooldownUntil > now) {
    const retryAfter = Math.ceil((emailAttempt.cooldownUntil - now) / 1000)

    await logSecurityEvent(event, 'LOGIN_RATE_LIMITED', {
      email,
      reason: 'email_cooldown',
      retryAfter
    })

    throw createError({
      statusCode: 429,
      message: 'Too many login attempts. Please try again later.',
      data: { retryAfter: Math.max(1, retryAfter) }
    })
  }

  // Check if max attempts exceeded
  if (emailAttempt.count >= EMAIL_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((emailAttempt.firstAttemptAt + EMAIL_WINDOW_MS - now) / 1000)

    await logSecurityEvent(event, 'LOGIN_RATE_LIMITED', {
      email,
      reason: 'email_limit_exceeded',
      retryAfter
    })

    throw createError({
      statusCode: 429,
      message: 'Too many login attempts. Please try again later.',
      data: { retryAfter: Math.max(1, retryAfter) }
    })
  }

  // ========================================================================
  // Perform login validation
  // ========================================================================
  const user = await findUserByEmail(email)

  // Track attempt for both IP and email (regardless of outcome)
  ipAttempt.count += 1
  ipAttempt.lastAttemptAt = now

  if (!user || !user.passwordHash) {
    emailAttempt.count += 1
    emailAttempt.lastAttemptAt = now
    emailAttempt.cooldownUntil = now + getCooldownDuration(emailAttempt.count)

    await logSecurityEvent(event, 'LOGIN_FAILED', {
      email,
      reason: 'user_not_found'
    })
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  if (user.status !== 'active') {
    emailAttempt.count += 1
    emailAttempt.lastAttemptAt = now
    emailAttempt.cooldownUntil = now + getCooldownDuration(emailAttempt.count)

    await logSecurityEvent(
      event,
      'LOGIN_FAILED',
      {
        email,
        reason: 'account_disabled',
        userId: user.id
      },
      {
        userId: user.id
      }
    )
    throw createError({ statusCode: 403, message: 'Kontot är inaktiverat.' })
  }

  const ssoRequired = await userRequiresSso(user.id)
  if (ssoRequired && !body.allowPasswordFallback) {
    // SSO requirement is not a "failed attempt" for rate limiting purposes
    await logSecurityEvent(
      event,
      'LOGIN_FAILED',
      {
        email,
        reason: 'sso_required',
        userId: user.id
      },
      {
        userId: user.id
      }
    )
    throw createError({ statusCode: 403, message: 'Organisation requires SSO' })
  }

  const isValid = await verifyPassword(body.password, user.passwordHash)
  if (!isValid) {
    emailAttempt.count += 1
    emailAttempt.lastAttemptAt = now
    emailAttempt.cooldownUntil = now + getCooldownDuration(emailAttempt.count)

    await logSecurityEvent(
      event,
      'LOGIN_FAILED',
      {
        email,
        reason: 'wrong_password',
        userId: user.id
      },
      {
        userId: user.id
      }
    )
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  // ========================================================================
  // Successful login - reset rate limit counters for this email
  // ========================================================================
  emailAttempts.delete(email)

  await touchUserLogin(user.id)
  const auth = await createSession(event, user.id)

  // Log successful login
  await logSecurityEvent(
    event,
    'LOGIN_SUCCESS',
    {
      email,
      userId: user.id
    },
    {
      userId: user.id,
      orgId: auth.currentOrgId || undefined,
      tenantId: auth.currentTenantId || undefined
    }
  )

  return auth
})
