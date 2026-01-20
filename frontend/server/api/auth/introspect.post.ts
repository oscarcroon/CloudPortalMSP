import crypto from 'node:crypto'
import { useRuntimeConfig } from '#imports'
import { createError, defineEventHandler, getHeader, getMethod, readRawBody } from 'h3'
import { z } from 'zod'
import { buildAuthState } from '../../utils/auth'
import { getClientIP } from '../../utils/ip'
import { decodeSessionToken } from '../../utils/session'

// ============================================================================
// Configuration
// ============================================================================

const MAX_BODY_SIZE_BYTES = 16 * 1024 // 16KB max body size
const MAX_TOKEN_LENGTH = 10_000
const MIN_TOKEN_LENGTH = 20

const RATE_LIMIT = Number(process.env.AUTH_INTROSPECT_RATE_LIMIT) || 120
const RATE_WINDOW_MS = Number(process.env.AUTH_INTROSPECT_RATE_WINDOW_MS) || 60_000

// ============================================================================
// Rate limiting (best-effort in-memory, single instance)
// ============================================================================

interface RateBucket {
  count: number
  resetAt: number
}

const rateBuckets = new Map<string, RateBucket>()
const MAX_RATE_BUCKETS = 10_000

const getRateLimitKey = (event: Parameters<typeof getClientIP>[0]) => {
  const ip = getClientIP(event) || 'unknown'
  const userAgent = getHeader(event, 'user-agent') || ''
  // Use IP + truncated user-agent hash to reduce NAT collision issues
  const uaHash = userAgent ? crypto.createHash('md5').update(userAgent).digest('hex').slice(0, 8) : ''
  return `${ip}|${uaHash}`
}

const enforceRateLimit = (event: Parameters<typeof getClientIP>[0]) => {
  // Allow disabling rate limiting explicitly (e.g., for testing)
  if (!Number.isFinite(RATE_LIMIT) || RATE_LIMIT <= 0) {
    return
  }

  const now = Date.now()
  const key = getRateLimitKey(event)

  const existing = rateBuckets.get(key)
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    pruneRateBuckets(now)
    return
  }

  existing.count += 1
  if (existing.count > RATE_LIMIT) {
    throw createError({
      statusCode: 429,
      message: 'Too many requests',
      data: { retryAfter: Math.ceil((existing.resetAt - now) / 1000) }
    })
  }
}

const pruneRateBuckets = (now: number) => {
  if (rateBuckets.size <= MAX_RATE_BUCKETS) {
    return
  }
  // Simple pruning: remove expired entries
  for (const [k, v] of rateBuckets) {
    if (v.resetAt <= now) {
      rateBuckets.delete(k)
    }
  }
  // If still too many, remove oldest
  if (rateBuckets.size > MAX_RATE_BUCKETS) {
    const overflow = rateBuckets.size - MAX_RATE_BUCKETS
    const it = rateBuckets.keys()
    for (let i = 0; i < overflow; i++) {
      const key = it.next().value
      if (key) rateBuckets.delete(key)
    }
  }
}

// ============================================================================
// Security utilities
// ============================================================================

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Returns false if lengths differ (without leaking via timingSafeEqual).
 */
const safeEquals = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a || '', 'utf8')
  const bBuf = Buffer.from(b || '', 'utf8')
  if (aBuf.length !== bBuf.length) {
    return false
  }
  return crypto.timingSafeEqual(aBuf, bBuf)
}

// ============================================================================
// Request validation schema
// ============================================================================

const introspectBodySchema = z.object({
  token: z
    .string()
    .min(MIN_TOKEN_LENGTH, 'Token too short')
    .max(MAX_TOKEN_LENGTH, 'Token too large')
})

// ============================================================================
// Handler
// ============================================================================

export default defineEventHandler(async (event) => {
  // 1. Rate limiting (early, before any processing)
  enforceRateLimit(event)

  // 2. Method check
  const method = getMethod(event)
  if (method !== 'POST') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }

  // 3. Content-Type check
  const contentType = getHeader(event, 'content-type') || ''
  if (!contentType.includes('application/json')) {
    throw createError({ statusCode: 415, message: 'Content-Type must be application/json' })
  }

  // 4. Service token validation
  const config = useRuntimeConfig()
  const expected = (config.auth?.serviceToken || process.env.AUTH_SERVICE_TOKEN || '').trim()
  const isProd = process.env.NODE_ENV === 'production'

  // Hard fail in production if service token is not configured
  if (isProd && !expected) {
    console.error('[introspect] AUTH_SERVICE_TOKEN is not configured in production')
    throw createError({
      statusCode: 500,
      message: 'Auth service misconfigured'
    })
  }

  // Validate service token if configured
  if (expected) {
    const provided = (getHeader(event, 'x-service-token') || '').trim()
    if (!provided) {
      throw createError({ statusCode: 403, message: 'Service token required' })
    }
    if (!safeEquals(provided, expected)) {
      throw createError({ statusCode: 403, message: 'Invalid service token' })
    }
  }

  // 5. Read and validate body with size limit
  let rawBody: string | undefined
  try {
    rawBody = await readRawBody(event, 'utf8')
  } catch {
    throw createError({ statusCode: 400, message: 'Failed to read request body' })
  }

  if (!rawBody) {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_SIZE_BYTES) {
    throw createError({ statusCode: 413, message: 'Request body too large' })
  }

  // 6. Parse JSON
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid JSON' })
  }

  // 7. Validate schema
  const parsed = introspectBodySchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    throw createError({
      statusCode: 400,
      message: firstError?.message || 'Invalid request body'
    })
  }

  const token = parsed.data.token.trim()
  if (!token) {
    throw createError({ statusCode: 400, message: 'Token missing' })
  }

  // 8. Decode and build auth state
  const payload = decodeSessionToken(token)
  const auth = await buildAuthState(
    payload.userId,
    payload.currentOrgId,
    payload.currentTenantId,
    payload.orgRoles
  )

  return auth
})
