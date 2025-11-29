import { createError, deleteCookie, getCookie, getRequestHeaders, H3Event, setCookie } from 'h3'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from 'jsonwebtoken'
import type { SessionTokenPayload, AuthState, ZeroTrustIdentity } from '../types/auth'
import { buildAuthState, findUserByEmail } from './auth'
import { normalizeEmail } from './crypto'

const SESSION_COOKIE = 'auth_token'
const SESSION_VERSION = 1
const ZERO_TRUST_HEADER_KEYS = ['cf_authorization', 'cf-access-jwt-assertion']

const getRuntimeConfig = () => {
  const runtime = (globalThis as any)?.useRuntimeConfig?.()
  return runtime ?? {
    auth: {
      jwtSecret: process.env.AUTH_JWT_SECRET || 'dev-secret-change-me',
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
  return jwt.verify(token, getJwtSecret()) as SessionTokenPayload
}

const readTokenFromEvent = (event: H3Event) => getCookie(event, SESSION_COOKIE)

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
    const payload = jwt.verify(token, secret) as JwtPayload
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

