import { createHmac, timingSafeEqual } from 'node:crypto'
import { setCookie, deleteCookie, H3Event } from 'h3'

const CSRF_COOKIE = 'csrf_token'
const CSRF_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

/**
 * Derive a CSRF-specific secret from the JWT secret using HMAC.
 * This avoids needing a separate env variable.
 */
const deriveCsrfSecret = (jwtSecret: string): string => {
  return createHmac('sha256', jwtSecret).update('csrf-token-salt').digest('hex')
}

/**
 * Generate a signed CSRF token bound to a userId.
 * Format: `${userId}.${timestamp}.${hmacSignature}`
 */
export const generateCsrfToken = (userId: string, jwtSecret: string): string => {
  const secret = deriveCsrfSecret(jwtSecret)
  const timestamp = Date.now().toString(36)
  const payload = `${userId}.${timestamp}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${signature}`
}

/**
 * Validate a CSRF token: verify HMAC signature and check TTL.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export const validateCsrfToken = (token: string, userId: string, jwtSecret: string): boolean => {
  if (!token || typeof token !== 'string') return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [tokenUserId, timestamp, signature] = parts
  if (!tokenUserId || !timestamp || !signature) return false

  // Verify userId matches
  if (tokenUserId !== userId) return false

  // Check TTL
  const tokenTime = parseInt(timestamp, 36)
  if (isNaN(tokenTime)) return false
  if (Date.now() - tokenTime > CSRF_TTL_MS) return false

  // Verify HMAC signature with timing-safe comparison
  const secret = deriveCsrfSecret(jwtSecret)
  const payload = `${tokenUserId}.${timestamp}`
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex')

  try {
    const sigBuf = Buffer.from(signature, 'hex')
    const expectedBuf = Buffer.from(expectedSignature, 'hex')
    if (sigBuf.length !== expectedBuf.length) return false
    return timingSafeEqual(sigBuf, expectedBuf)
  } catch {
    return false
  }
}

/**
 * Set the CSRF token cookie (non-httpOnly so JavaScript can read it).
 */
export const setCsrfCookie = (event: H3Event, userId: string, jwtSecret: string) => {
  const token = generateCsrfToken(userId, jwtSecret)
  setCookie(event, CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 4 * 60 * 60 // 4 hours in seconds
  })
}

/**
 * Clear the CSRF token cookie.
 */
export const clearCsrfCookie = (event: H3Event) => {
  deleteCookie(event, CSRF_COOKIE, { path: '/' })
}

export const CSRF_COOKIE_NAME = CSRF_COOKIE
