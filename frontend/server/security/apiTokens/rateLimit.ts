/**
 * API Token Rate Limiting
 *
 * Rate limiting for org API tokens.
 * Uses in-memory store by default, can be swapped for Redis in production.
 */

import { createError, H3Event, setHeader } from 'h3'
import type { OrgApiTokenContext } from './ensureOrgApiToken'

// ============================================================================
// Configuration
// ============================================================================

// Default limits
const DEFAULT_TOKEN_LIMIT = 100 // requests per window
const DEFAULT_ORG_LIMIT = 500 // requests per window
const DEFAULT_WINDOW_MS = 60_000 // 1 minute

// Get limits from environment
const TOKEN_RATE_LIMIT = Number(process.env.API_TOKEN_RATE_LIMIT) || DEFAULT_TOKEN_LIMIT
const ORG_RATE_LIMIT = Number(process.env.API_ORG_RATE_LIMIT) || DEFAULT_ORG_LIMIT
const RATE_WINDOW_MS = Number(process.env.API_RATE_WINDOW_MS) || DEFAULT_WINDOW_MS

// ============================================================================
// In-Memory Store
// ============================================================================

interface RateBucket {
  count: number
  resetAt: number
}

const tokenBuckets = new Map<string, RateBucket>()
const orgBuckets = new Map<string, RateBucket>()
const MAX_BUCKETS = 50_000

// Periodic cleanup
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of tokenBuckets) {
    if (bucket.resetAt <= now) {
      tokenBuckets.delete(key)
    }
  }
  for (const [key, bucket] of orgBuckets) {
    if (bucket.resetAt <= now) {
      orgBuckets.delete(key)
    }
  }
}, 60_000)

// Prevent timer from keeping process alive
if (cleanupInterval.unref) {
  cleanupInterval.unref()
}

// ============================================================================
// Rate Limit Functions
// ============================================================================

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

function checkBucket(
  buckets: Map<string, RateBucket>,
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  let bucket = buckets.get(key)

  // Create or reset bucket if expired
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)

    // Trim if too many buckets
    if (buckets.size > MAX_BUCKETS) {
      const overflow = buckets.size - MAX_BUCKETS
      const it = buckets.keys()
      for (let i = 0; i < overflow; i++) {
        const k = it.next().value
        if (k) buckets.delete(k)
      }
    }
  }

  // Increment and check
  bucket.count += 1

  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfter: Math.max(1, retryAfter),
    }
  }

  return {
    allowed: true,
    remaining: limit - bucket.count,
    resetAt: bucket.resetAt,
  }
}

/**
 * Check rate limits for an API token.
 * Sets rate limit headers on the response.
 */
export function checkApiTokenRateLimit(
  event: H3Event,
  token: OrgApiTokenContext
): void {
  const now = Date.now()

  // Check token-level limit
  const tokenResult = checkBucket(
    tokenBuckets,
    `token:${token.tokenId}`,
    TOKEN_RATE_LIMIT,
    RATE_WINDOW_MS
  )

  // Check org-level limit
  const orgResult = checkBucket(
    orgBuckets,
    `org:${token.orgId}`,
    ORG_RATE_LIMIT,
    RATE_WINDOW_MS
  )

  // Use the more restrictive result
  const isAllowed = tokenResult.allowed && orgResult.allowed
  const remaining = Math.min(tokenResult.remaining, orgResult.remaining)
  const resetAt = Math.max(tokenResult.resetAt, orgResult.resetAt)

  // Set rate limit headers
  setHeader(event, 'X-RateLimit-Limit', String(TOKEN_RATE_LIMIT))
  setHeader(event, 'X-RateLimit-Remaining', String(remaining))
  setHeader(event, 'X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

  if (!isAllowed) {
    const retryAfter = tokenResult.retryAfter || orgResult.retryAfter || 60
    setHeader(event, 'Retry-After', String(retryAfter))

    throw createError({
      statusCode: 429,
      message: 'Too many requests',
      data: {
        retryAfter,
        limitType: !tokenResult.allowed ? 'token' : 'organization',
      },
    })
  }
}

/**
 * Enforce rate limiting for API token requests.
 * Call this after successful token authentication.
 */
export async function enforceApiTokenRateLimit(
  event: H3Event,
  token: OrgApiTokenContext
): Promise<void> {
  checkApiTokenRateLimit(event, token)
}

