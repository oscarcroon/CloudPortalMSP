import type { NextFunction, Request, Response } from 'express'
import type { UserContext } from '../types/domain.js'
import {
  rolePermissionMap,
  tenantRoleOrgProxyPermissions
} from '../constants/rbac.js'
import type { OrgPermission, TenantRole } from '../constants/rbac.js'

declare module 'express-serve-static-core' {
  interface Request {
    userContext?: UserContext
  }
}

// ============================================================================
// Configuration
// ============================================================================

const AUTH_CACHE_TTL_MS = Number(process.env.AUTH_INTROSPECT_CACHE_TTL_MS) || 30_000
const AUTH_CACHE_MAX = Number(process.env.AUTH_INTROSPECT_CACHE_MAX) || 5_000
const AUTH_TIMEOUT_MS = Number(process.env.AUTH_INTROSPECT_TIMEOUT_MS) || 2_500
const NEGATIVE_CACHE_TTL_MS = 3_000 // Cache invalid token responses briefly

// ============================================================================
// Types
// ============================================================================

type IntrospectAuthState = {
  user: { id: string; email: string }
  organizations: Array<{
    id: string
    name: string
    role: keyof typeof rolePermissionMap
    tenantId?: string | null
  }>
  tenants?: Array<{ id: string; name: string; type: string; role: string; includeChildren?: boolean }>
  currentOrgId: string
  currentTenantId?: string | null
  orgRoles: Record<string, keyof typeof rolePermissionMap>
  tenantRoles?: Record<string, string>
  tenantIncludeChildren?: Record<string, boolean>
}

type CacheEntry =
  | { type: 'value'; value: IntrospectAuthState; expiresAt: number }
  | { type: 'inflight'; promise: Promise<IntrospectAuthState>; expiresAt: number }
  | { type: 'negative'; expiresAt: number } // Cache for invalid tokens

// ============================================================================
// Cache (best-effort in-memory, single instance)
// ============================================================================

const authCache = new Map<string, CacheEntry>()

const trimCache = () => {
  if (authCache.size <= AUTH_CACHE_MAX) return

  const overflow = authCache.size - AUTH_CACHE_MAX
  const now = Date.now()

  // First pass: remove expired entries
  for (const [key, entry] of authCache) {
    if (entry.expiresAt <= now) {
      authCache.delete(key)
    }
  }

  // Second pass: if still too many, remove oldest
  if (authCache.size > AUTH_CACHE_MAX) {
    const keysToRemove = authCache.size - AUTH_CACHE_MAX
    const it = authCache.keys()
    for (let i = 0; i < keysToRemove; i++) {
      const key = it.next().value
      if (key) authCache.delete(key)
    }
  }
}

const getCachedValue = (token: string): IntrospectAuthState | 'negative' | null => {
  const entry = authCache.get(token)
  if (!entry) return null

  const now = Date.now()
  if (entry.expiresAt <= now) {
    authCache.delete(token)
    return null
  }

  if (entry.type === 'value') return entry.value
  if (entry.type === 'negative') return 'negative'
  return null
}

// ============================================================================
// Session cookie parsing
// ============================================================================

const SESSION_COOKIE = 'auth_token'

const parseSessionCookie = (cookieHeader?: string | null) => {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map((part) => part.trim())
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=')
    if (name === SESSION_COOKIE) {
      return rest.join('=')
    }
  }
  return null
}

// ============================================================================
// Environment validation
// ============================================================================

let envValidated = false

const validateEnv = () => {
  if (envValidated) return
  envValidated = true

  const isProd = process.env.NODE_ENV === 'production'
  const serviceToken = (process.env.AUTH_SERVICE_TOKEN || '').trim()
  const introspectUrl = (process.env.AUTH_INTROSPECT_URL || '').trim()

  if (isProd) {
    if (!serviceToken) {
      throw new Error(
        '[context middleware] AUTH_SERVICE_TOKEN is required in production for secure introspection'
      )
    }
    if (!introspectUrl) {
      throw new Error(
        '[context middleware] AUTH_INTROSPECT_URL is required in production'
      )
    }
  }
}

// ============================================================================
// Auth introspection with cache + timeout
// ============================================================================

const rawFetchAuthState = async (token: string): Promise<IntrospectAuthState> => {
  const url = process.env.AUTH_INTROSPECT_URL
  if (!url) {
    throw new Error('AUTH_INTROSPECT_URL is not configured')
  }

  const serviceToken = (process.env.AUTH_SERVICE_TOKEN || '').trim()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(serviceToken ? { 'x-service-token': serviceToken } : {})
      },
      body: JSON.stringify({ token }),
      signal: controller.signal
    })

    if (!response.ok) {
      // Cache negative result briefly if unauthorized/forbidden
      if (response.status === 401 || response.status === 403) {
        authCache.set(token, {
          type: 'negative',
          expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS
        })
        trimCache()
      }
      throw new Error(`Auth introspection failed with status ${response.status}`)
    }

    return (await response.json()) as IntrospectAuthState
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Auth introspection timed out after ${AUTH_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

const fetchAuthState = async (token: string): Promise<IntrospectAuthState> => {
  // Check cache first
  const cached = getCachedValue(token)
  if (cached === 'negative') {
    throw new Error('Auth introspection failed (cached negative)')
  }
  if (cached) {
    return cached
  }

  // Check for inflight request (de-dup)
  const existing = authCache.get(token)
  if (existing && existing.type === 'inflight' && existing.expiresAt > Date.now()) {
    return existing.promise
  }

  // Create new request with inflight tracking
  const promise = rawFetchAuthState(token)
    .then((value) => {
      authCache.set(token, {
        type: 'value',
        value,
        expiresAt: Date.now() + AUTH_CACHE_TTL_MS
      })
      trimCache()
      return value
    })
    .catch((err) => {
      // Remove inflight entry on error (negative caching handled in rawFetch)
      const current = authCache.get(token)
      if (current && current.type === 'inflight') {
        authCache.delete(token)
      }
      throw err
    })

  // Store inflight promise with short TTL to prevent stampede
  authCache.set(token, {
    type: 'inflight',
    promise,
    expiresAt: Date.now() + Math.min(5_000, AUTH_CACHE_TTL_MS)
  })
  trimCache()

  return promise
}

// ============================================================================
// Middleware
// ============================================================================

export async function tenantContext(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate environment on first request
    validateEnv()

    const token = parseSessionCookie(req.headers.cookie)
    if (!token) {
      res.status(401).json({ message: 'Missing session' })
      return
    }

    const authState = await fetchAuthState(token)
    const currentOrgId = authState.currentOrgId
    const role = authState.orgRoles[currentOrgId]
    const permissions: OrgPermission[] = role ? [...rolePermissionMap[role]] : []

    const currentOrg = authState.organizations.find((org) => org.id === currentOrgId)
    if (currentOrg?.tenantId) {
      const tenantMembership =
        authState.tenants?.find((tenant) => tenant.id === currentOrg.tenantId) ?? null
      const includeChildren =
        authState.tenantIncludeChildren?.[currentOrg.tenantId] ??
        tenantMembership?.includeChildren ??
        false
      const tenantRole =
        authState.tenantRoles?.[currentOrg.tenantId] ?? tenantMembership?.role ?? null
      const tenantType = tenantMembership?.type
      const canProxy =
        includeChildren && tenantType && ['provider', 'distributor'].includes(tenantType)

      if (canProxy && tenantRole) {
        // Validate that tenantRole is a valid TenantRole before using it
        // This prevents silent failures when invalid role strings are present
        if (tenantRole in tenantRoleOrgProxyPermissions) {
          const proxyPermissions =
            tenantRoleOrgProxyPermissions[tenantRole as TenantRole]
          if (proxyPermissions) {
            for (const perm of proxyPermissions) {
              if (!permissions.includes(perm)) {
                permissions.push(perm)
              }
            }
          }
        } else {
          // Log warning when invalid tenant role is encountered
          console.warn(
            `Invalid tenant role "${tenantRole}" for tenant ${currentOrg.tenantId}. ` +
              `Expected one of: ${Object.keys(tenantRoleOrgProxyPermissions).join(', ')}`
          )
        }
      }
    }

    req.userContext = {
      id: authState.user.id,
      email: authState.user.email,
      activeOrganisationId: currentOrgId,
      organisations: authState.organizations.map((org) => ({
        id: org.id,
        name: org.name,
        role: org.role
      })),
      permissions
    }

    next()
  } catch (error) {
    console.error('Failed to resolve auth context', error)
    res.status(401).json({ message: 'Authentication required' })
  }
}
