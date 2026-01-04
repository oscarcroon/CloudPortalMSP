import { createHash } from 'crypto'
import type { WindowsDnsTokenScope } from './types'

/**
 * Client-side token cache with singleflight protection.
 * 
 * This cache works in conjunction with the backend's mint-or-return-existing logic:
 * 
 * Client-side (this file):
 * - Singleflight: Prevents parallel mint requests for the same token
 * - Local TTL: Avoids unnecessary API calls when token is still valid
 * - Safety window: Triggers refresh before actual expiry
 * 
 * Backend-side:
 * - Fingerprinting: Same scopes + zone selector = same token returned
 * - Sliding TTL: Token expiry extended on access (within max age)
 * - Deterministic: Token string is derived, not random
 * 
 * Together, this eliminates token spam while maintaining security.
 * 
 * TTL values should align with DRIFT_TOKEN_TTL_HOURS from client.ts
 */

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour (matches DRIFT_TOKEN_TTL_HOURS)
const SAFETY_WINDOW_MS = 15 * 60 * 1000 // 15 min (matches DRIFT_TOKEN_RENEW_WINDOW_MINUTES)

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
// Key format: cacheKey (hash) -> CachedToken
// We also maintain a reverse lookup for org-based invalidation
const tokenCache = new Map<string, CachedToken>()
const pendingMints = new Map<string, PendingMint>()
const cacheKeyToOrgId = new Map<string, string>()

/**
 * Generate a deterministic cache key for a token request.
 * Also stores the orgId mapping for later invalidation.
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
  const cacheKey = createHash('sha256').update(raw).digest('hex').slice(0, 32)
  
  // Store the orgId mapping for later invalidation
  cacheKeyToOrgId.set(cacheKey, params.orgId)
  
  return cacheKey
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
 * 
 * This provides client-side deduplication of concurrent requests:
 * - If token exists in cache and is valid, returns it immediately
 * - If a mint is already in progress, awaits that instead of making a parallel call
 * - Otherwise, calls the backend which handles mint-or-return-existing
 * 
 * The backend also deduplicates via fingerprinting, so even on cache miss
 * we get efficient token reuse.
 *
 * @param cacheKey - The cache key for this token request
 * @param mintFn - Async function that mints/retrieves a token from WindowsDNS backend
 * @returns The cached or newly retrieved token
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
 * Invalidate all tokens for an org (e.g., when org config changes or tokens expire).
 */
export const invalidateOrgTokens = (orgId: string): void => {
  const keysToDelete: string[] = []
  
  for (const [cacheKey, mappedOrgId] of cacheKeyToOrgId.entries()) {
    if (mappedOrgId === orgId) {
      keysToDelete.push(cacheKey)
    }
  }
  
  for (const key of keysToDelete) {
    tokenCache.delete(key)
    cacheKeyToOrgId.delete(key)
    pendingMints.delete(key)
  }
  
  if (keysToDelete.length > 0) {
    console.log(`[windows-dns] Invalidated ${keysToDelete.length} cached tokens for org ${orgId}`)
  }
}

/**
 * Clear all cached tokens (useful for testing or emergency invalidation).
 */
export const clearAllTokens = (): void => {
  tokenCache.clear()
  pendingMints.clear()
  cacheKeyToOrgId.clear()
}

/**
 * Get cache stats for debugging/monitoring.
 */
export const getCacheStats = (): { size: number; pendingMints: number } => ({
  size: tokenCache.size,
  pendingMints: pendingMints.size
})

