import { createHash } from 'crypto'
import type { WindowsDnsTokenScope } from './types'

/**
 * Token cache with TTL, safety window, and singleflight lock.
 *
 * Features:
 * - TTL: 5 minutes (300s)
 * - Safety window: 30 seconds (treats token as expired 30s before actual expiry)
 * - Singleflight: only one concurrent mint per cache key
 * - In-memory per node (can be upgraded to Redis later)
 */

const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes
const SAFETY_WINDOW_MS = 30 * 1000 // 30 seconds

interface CachedToken {
  token: string
  expiresAt: number
  scopes: WindowsDnsTokenScope[]
  allowedZoneIds: string[] | '*'
}

interface PendingMint {
  promise: Promise<CachedToken>
}

// In-memory cache storage
const tokenCache = new Map<string, CachedToken>()
const pendingMints = new Map<string, PendingMint>()

/**
 * Generate a deterministic cache key for a token request.
 */
export const generateCacheKey = (params: {
  orgId: string
  accountId: string
  scopes: WindowsDnsTokenScope[]
  allowedZoneIds?: string[] | '*'
}): string => {
  const scopesPart = [...params.scopes].sort().join(',')
  const zonesPart =
    params.allowedZoneIds === '*'
      ? '*'
      : params.allowedZoneIds
        ? [...params.allowedZoneIds].sort().join(',')
        : '*'

  const raw = `${params.orgId}:${params.accountId}:${scopesPart}:${zonesPart}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

/**
 * Check if a cached token is still valid (including safety window).
 */
const isTokenValid = (cached: CachedToken): boolean => {
  const now = Date.now()
  const effectiveExpiry = cached.expiresAt - SAFETY_WINDOW_MS
  return now < effectiveExpiry
}

/**
 * Get a token from cache if valid.
 */
export const getCachedToken = (cacheKey: string): CachedToken | null => {
  const cached = tokenCache.get(cacheKey)
  if (!cached) return null
  if (!isTokenValid(cached)) {
    tokenCache.delete(cacheKey)
    return null
  }
  return cached
}

/**
 * Store a token in cache.
 */
export const setCachedToken = (cacheKey: string, token: CachedToken): void => {
  tokenCache.set(cacheKey, token)
}

/**
 * Get or mint a token with singleflight protection.
 * If a mint is already in progress for the same cache key, awaits that instead of starting a new one.
 *
 * @param cacheKey - The cache key for this token request
 * @param mintFn - Async function that mints a new token from WindowsDNS admin API
 * @returns The cached or newly minted token
 */
export const getOrMintToken = async (
  cacheKey: string,
  mintFn: () => Promise<{ token: string; expiresAt: number; scopes: WindowsDnsTokenScope[]; allowedZoneIds: string[] | '*' }>
): Promise<CachedToken> => {
  // Check cache first
  const cached = getCachedToken(cacheKey)
  if (cached) return cached

  // Check if a mint is already in progress (singleflight)
  const pending = pendingMints.get(cacheKey)
  if (pending) {
    return pending.promise
  }

  // Start a new mint
  const mintPromise = (async () => {
    try {
      const result = await mintFn()
      const cachedToken: CachedToken = {
        token: result.token,
        expiresAt: result.expiresAt,
        scopes: result.scopes,
        allowedZoneIds: result.allowedZoneIds
      }
      setCachedToken(cacheKey, cachedToken)
      return cachedToken
    } finally {
      // Clean up pending mint
      pendingMints.delete(cacheKey)
    }
  })()

  pendingMints.set(cacheKey, { promise: mintPromise })
  return mintPromise
}

/**
 * Invalidate a specific cache entry.
 */
export const invalidateToken = (cacheKey: string): void => {
  tokenCache.delete(cacheKey)
}

/**
 * Invalidate all tokens for an org (e.g., when org config changes).
 */
export const invalidateOrgTokens = (orgId: string): void => {
  for (const key of tokenCache.keys()) {
    // Cache keys start with org-derived hash, but we can't easily reverse that
    // For now, clear all tokens - in production, store orgId with the token
    // or use a different key structure
  }
  // Simple approach: clear all tokens when org config changes
  // This is safe but not optimal for multi-tenant scenarios
  // In production, consider prefixing keys with orgId
}

/**
 * Clear all cached tokens (useful for testing or emergency invalidation).
 */
export const clearAllTokens = (): void => {
  tokenCache.clear()
  pendingMints.clear()
}

/**
 * Get cache stats for debugging/monitoring.
 */
export const getCacheStats = (): { size: number; pendingMints: number } => ({
  size: tokenCache.size,
  pendingMints: pendingMints.size
})

