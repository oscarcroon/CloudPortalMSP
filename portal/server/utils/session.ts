import { createError, deleteCookie, getCookie, getRequestHeaders, H3Event, setCookie } from 'h3'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from 'jsonwebtoken'
import type { SessionTokenPayload, AuthState, ZeroTrustIdentity } from '../types/auth'
import { buildAuthState, findUserByEmail } from './auth'
import { normalizeEmail } from './crypto'

const SESSION_COOKIE = 'auth_token'
const SESSION_VERSION = 1
const ZERO_TRUST_HEADER_KEYS = ['cf_authorization', 'cf-access-jwt-assertion']

// Dangerous secrets that must NEVER be used in production
const DANGEROUS_JWT_SECRETS = new Set([
  'dev-secret-change-me',
  'secret',
  'changeme',
  'test',
  'development'
])

const getRuntimeConfig = () => {
  const runtime = (globalThis as any)?.useRuntimeConfig?.()
  return runtime ?? {
    auth: {
      // SECURITY: In production, AUTH_JWT_SECRET is validated at startup by validate-env plugin.
      // The dev fallback is ONLY for local development.
      jwtSecret: process.env.AUTH_JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-change-me'),
      sessionTtl: process.env.AUTH_SESSION_TTL || '12h',
      serviceToken: process.env.AUTH_SERVICE_TOKEN || '',
      cloudflareZeroTrustSecret: process.env.CLOUDFLARE_ZT_JWT_SECRET || '',
      allowSelfRegistration: process.env.AUTH_ALLOW_SELF_REGISTRATION === 'true'
    }
  }
}

const getJwtSecret = () => {
  const config = getRuntimeConfig()
  const secret = config.auth?.jwtSecret || process.env.AUTH_JWT_SECRET

  if (!secret) {
    throw new Error('Missing AUTH_JWT_SECRET runtime config')
  }

  // Additional runtime guard: never allow dangerous defaults in production
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && DANGEROUS_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new Error(
      'AUTH_JWT_SECRET is set to a dangerous default value in production. ' +
        'This is a critical security misconfiguration.'
    )
  }

  return secret
}

const getZeroTrustSecret = () =>
  getRuntimeConfig().auth?.cloudflareZeroTrustSecret || process.env.CLOUDFLARE_ZT_JWT_SECRET

const signToken = (payload: SessionTokenPayload) => {
  const runtime = getRuntimeConfig()
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: runtime.auth?.sessionTtl ?? '12h'
  })
}

const verifyToken = (token: string) => {
  // SECURITY: Explicitly specify algorithm to prevent algorithm confusion attacks
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256']
  }) as SessionTokenPayload
}

/**
 * Check if a token looks like a JWT (three dot-separated base64 segments).
 * This is used to distinguish JWTs from opaque PAT tokens.
 */
const looksLikeJwt = (token: string): boolean => {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  // Basic check that parts look like base64url
  const base64UrlPattern = /^[A-Za-z0-9_-]+$/
  return parts.every((part) => base64UrlPattern.test(part))
}

/**
 * Extract Bearer token from Authorization header, but only if it looks like a JWT.
 * PAT tokens (which start with msp_pat. or don't look like JWTs) are ignored.
 */
const extractBearerJwt = (event: H3Event): string | null => {
  const headers = getRequestHeaders(event)
  const authHeader = headers.authorization || headers.Authorization

  if (!authHeader) return null

  // Must be Bearer scheme
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  const token = match[1]

  // Ignore PAT tokens (they start with known prefixes)
  if (token.startsWith('msp_pat.') || token.startsWith('msp_org.')) {
    return null
  }

  // Only accept tokens that look like JWTs
  if (!looksLikeJwt(token)) {
    return null
  }

  return token
}

/**
 * Read session token from event - checks cookie first, then Authorization header.
 */
const readTokenFromEvent = (event: H3Event): string | undefined => {
  // First, try cookie
  const cookieToken = getCookie(event, SESSION_COOKIE)
  if (cookieToken) {
    return cookieToken
  }

  // Then, try Authorization header (Bearer JWT only)
  const bearerToken = extractBearerJwt(event)
  if (bearerToken) {
    return bearerToken
  }

  return undefined
}

const writeSessionCookie = (event: H3Event, token: string) => {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  })
}

export const destroySession = (event: H3Event) => {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  event.context.auth = null
}

export const ensureAuthState = async (event: H3Event) => {
  if (event.context.auth) {
    return event.context.auth
  }

  const token = readTokenFromEvent(event)
  if (!token) {
    return maybeBootstrapFromZeroTrust(event)
  }

  try {
    const payload = verifyToken(token)
    const auth = await buildAuthState(
      payload.userId,
      payload.currentOrgId,
      payload.currentTenantId,
      payload.orgRoles
    )
    // Don't merge tenant roles from token - always use fresh data from database
    // Token roles may be stale if roles were changed after token was issued
    // Database roles are always up-to-date and take precedence
    // Override currentTenantId/currentOrgId from token if present
    if (payload.currentTenantId !== undefined) {
      auth.currentTenantId = payload.currentTenantId
    }
    if (payload.currentOrgId !== undefined) {
      auth.currentOrgId = payload.currentOrgId
    }
    
    event.context.auth = auth
    return auth
  } catch (error) {
    destroySession(event)
    console.warn('Invalid session token', error)
    return maybeBootstrapFromZeroTrust(event)
  }
}

export const createSession = async (
  event: H3Event,
  userId: string,
  forcedOrgId?: string | null,
  forcedTenantId?: string | null
): Promise<AuthState> => {
  const auth = await buildAuthState(userId, forcedOrgId, forcedTenantId)
  if (auth.currentOrgId && !canAccessOrganization(auth, auth.currentOrgId)) {
    auth.currentOrgId = null
  }
  const token = signToken({
    userId: auth.user.id,
    currentOrgId: auth.currentOrgId,
    currentTenantId: auth.currentTenantId,
    orgRoles: auth.orgRoles,
    tenantRoles: auth.tenantRoles,
    tenantIncludeChildren: auth.tenantIncludeChildren,
    version: SESSION_VERSION
  })
  writeSessionCookie(event, token)
  event.context.auth = auth
  return auth
}

export const refreshSession = async (
  event: H3Event,
  newOrgId?: string | null,
  newTenantId?: string | null
) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }
  return createSession(
    event,
    auth.user.id,
    newOrgId !== undefined ? newOrgId : auth.currentOrgId,
    newTenantId !== undefined ? newTenantId : auth.currentTenantId
  )
}

export const requireSession = async (event: H3Event) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Missing session' })
  }
  return auth
}

const extractZeroTrustToken = (event: H3Event) => {
  const headers = getRequestHeaders(event)
  for (const key of ZERO_TRUST_HEADER_KEYS) {
    const candidate = headers[key] || headers[key.toUpperCase()]
    if (candidate) {
      return candidate
    }
  }
  return null
}

const verifyZeroTrustToken = (token: string): ZeroTrustIdentity | null => {
  const secret = getZeroTrustSecret()
  if (!secret) {
    return null
  }
  try {
    // SECURITY: Explicitly specify algorithm to prevent algorithm confusion attacks
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256']
    }) as JwtPayload
    if (!payload.email && typeof payload.sub !== 'string') {
      return null
    }
    return {
      email: normalizeEmail(
        typeof payload.email === 'string' ? payload.email : (payload.sub as string)
      ),
      issuer: typeof payload.iss === 'string' ? payload.iss : undefined,
      subject: typeof payload.sub === 'string' ? payload.sub : undefined,
      audience: payload.aud,
      expiresAt: typeof payload.exp === 'number' ? payload.exp * 1000 : undefined
    }
  } catch (error) {
    console.warn('Failed to verify Zero Trust token', error)
    return null
  }
}

const maybeBootstrapFromZeroTrust = async (event: H3Event) => {
  const token = extractZeroTrustToken(event)
  if (!token) {
    return null
  }
  const identity = verifyZeroTrustToken(token)
  if (!identity?.email) {
    return null
  }
  const user = await findUserByEmail(identity.email)
  if (!user) {
    return null
  }
  return createSession(event, user.id, user.defaultOrgId ?? null)
}

export const decodeSessionToken = (token: string) => verifyToken(token)

export const getSessionCookieName = () => SESSION_COOKIE

const canAccessOrganization = (auth: AuthState, organizationId: string | null) => {
  if (!organizationId) {
    return false
  }
  const org = auth.organizations.find((item) => item.id === organizationId)
  if (!org) {
    return false
  }
  if (!org.requireSso) {
    return true
  }
  if (auth.user.isSuperAdmin) {
    return true
  }
  return Boolean(org.hasLocalLoginOverride)
}

