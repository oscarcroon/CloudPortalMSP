import { defineEventHandler, createError, getCookie, getRequestHeaders } from 'h3'
import { validateCsrfToken, setCsrfCookie, CSRF_COOKIE_NAME } from '../utils/csrf'
import { getJwtSecret } from '../utils/session'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const EXEMPT_PATH_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/password/forgot',
  '/api/auth/password/reset',
  '/api/auth/sso/',
  '/api/auth/introspect',
  '/api/invite/'
]

const isExemptPath = (path: string): boolean => {
  return EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
}

const hasBearerToken = (event: Parameters<typeof getRequestHeaders>[0]): boolean => {
  const headers = getRequestHeaders(event)
  const authHeader = headers.authorization || headers.Authorization
  if (!authHeader) return false
  return /^Bearer\s+/i.test(authHeader)
}

export default defineEventHandler((event) => {
  const method = event.method?.toUpperCase() || 'GET'
  const path = event.path || ''

  // 1. Safe methods: set/refresh CSRF cookie if user is authenticated, then skip validation
  if (SAFE_METHODS.has(method)) {
    if (event.context.auth?.user?.id) {
      setCsrfCookie(event, event.context.auth.user.id, getJwtSecret())
    }
    return
  }

  // 2. Skip non-API routes (Nuxt pages, assets, etc.)
  if (!path.startsWith('/api/')) {
    return
  }

  // 3. Skip exempt paths
  if (isExemptPath(path)) {
    return
  }

  // 4. Skip Bearer-token auth (PAT/API tokens are not cookie-based, not CSRF-vulnerable)
  if (hasBearerToken(event)) {
    return
  }

  // 5. Skip if no session (route will 401 anyway)
  if (!event.context.auth?.user?.id) {
    return
  }

  // 6. Validate CSRF token
  const userId = event.context.auth.user.id
  const jwtSecret = getJwtSecret()
  const headerToken = getRequestHeaders(event)['x-csrf-token'] as string | undefined
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME)

  if (!headerToken || !cookieToken) {
    throw createError({
      statusCode: 403,
      message: 'Missing CSRF token'
    })
  }

  // Header and cookie must match
  if (headerToken !== cookieToken) {
    throw createError({
      statusCode: 403,
      message: 'CSRF token mismatch'
    })
  }

  // Validate HMAC signature and TTL
  if (!validateCsrfToken(headerToken, userId, jwtSecret)) {
    throw createError({
      statusCode: 403,
      message: 'Invalid CSRF token'
    })
  }

  // 7. Refresh CSRF cookie on successful validation
  setCsrfCookie(event, userId, jwtSecret)
})
