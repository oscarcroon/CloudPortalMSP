import { H3Event, createError, getRequestURL } from 'h3'
import { ensureAuthState } from '../utils/session'
import { getClientIP } from './ip'
import { logSecurityEvent } from './audit'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (event: H3Event) => string | Promise<string> // Custom key generator
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory store (for production, use Redis or similar)
const store: RateLimitStore = {}

const cleanupInterval = 60 * 1000 // Clean up every minute

// Cleanup old entries
setInterval(() => {
  const now = Date.now()
  for (const key in store) {
    const entry = store[key]
    if (!entry) {
      continue
    }
    if (entry.resetTime < now) {
      delete store[key]
    }
  }
}, cleanupInterval)

/**
 * Rate limiting middleware
 */
export const rateLimit = (config: RateLimitConfig) => {
  return async (event: H3Event) => {
    const key = config.keyGenerator
      ? await config.keyGenerator(event)
      : await getDefaultKey(event)

    const now = Date.now()
    const entry = store[key]

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      store[key] = {
        count: 1,
        resetTime: now + config.windowMs
      }
      return
    }

    // Increment count
    entry.count++

    if (entry.count > config.maxRequests) {
      const url = getRequestURL(event)
      const method = event.node.req.method
      
      // Log rate limit violation
      try {
        const auth = await ensureAuthState(event)
        await logSecurityEvent(event, 'RATE_LIMIT_EXCEEDED', {
          endpoint: url.pathname,
          method,
          limitType: config.keyGenerator ? 'custom' : 'default',
          limit: config.maxRequests,
          windowMs: config.windowMs,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        }, {
          userId: auth?.user.id || null
        })
      } catch {
        // Log even if auth fails
        await logSecurityEvent(event, 'RATE_LIMIT_EXCEEDED', {
          endpoint: url.pathname,
          method,
          limitType: config.keyGenerator ? 'custom' : 'default',
          limit: config.maxRequests,
          windowMs: config.windowMs,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        })
      }
      
      throw createError({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
        data: {
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        }
      })
    }
  }
}

/**
 * Default key generator: IP address + user ID if authenticated
 */
const getDefaultKey = async (event: H3Event): Promise<string> => {
  const ip = getClientIP(event) || 'unknown'
  try {
    const auth = await ensureAuthState(event)
    if (auth) {
      return `${ip}:user:${auth.user.id}`
    }
  } catch {
    // Not authenticated, use IP only
  }
  return `ip:${ip}`
}

/**
 * Pre-configured rate limiters for common endpoints
 */
export const rateLimiters = {
  login: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts per 15 minutes
    keyGenerator: async (event) => {
      const ip = getClientIP(event) || 'unknown'
      return `login:ip:${ip}`
    }
  }),

  contextSwitch: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 context switches per minute
    keyGenerator: async (event) => {
      const ip = getClientIP(event) || 'unknown'
      try {
        const auth = await ensureAuthState(event)
        if (auth) {
          return `context-switch:user:${auth.user.id}`
        }
      } catch {
        // Not authenticated
      }
      return `context-switch:ip:${ip}`
    }
  }),

  sensitiveActions: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 sensitive actions per minute
    keyGenerator: async (event) => {
      const ip = getClientIP(event) || 'unknown'
      try {
        const auth = await ensureAuthState(event)
        if (auth) {
          return `sensitive:user:${auth.user.id}`
        }
      } catch {
        // Not authenticated
      }
      return `sensitive:ip:${ip}`
    }
  }),

  mfaVerify: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10, // 10 MFA attempts per 5 minutes
    keyGenerator: async (event) => {
      const ip = getClientIP(event) || 'unknown'
      try {
        const auth = await ensureAuthState(event)
        if (auth) {
          return `mfa:user:${auth.user.id}`
        }
      } catch {
        // Not authenticated
      }
      return `mfa:ip:${ip}`
    }
  }),

  domainRegistration: rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 5, // 5 domain registrations per day per org
    keyGenerator: async (event) => {
      const ip = getClientIP(event) || 'unknown'
      try {
        const auth = await ensureAuthState(event)
        if (auth?.currentOrgId) {
          return `domain-reg:org:${auth.currentOrgId}`
        }
        if (auth?.user.id) {
          return `domain-reg:user:${auth.user.id}`
        }
      } catch {
        // Not authenticated
      }
      return `domain-reg:ip:${ip}`
    }
  }),

  domainVerification: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10, // 10 verification attempts per 5 minutes
    keyGenerator: async (event) => {
      const ip = getClientIP(event) || 'unknown'
      try {
        const auth = await ensureAuthState(event)
        if (auth?.currentOrgId) {
          return `domain-verify:org:${auth.currentOrgId}`
        }
        if (auth?.user.id) {
          return `domain-verify:user:${auth.user.id}`
        }
      } catch {
        // Not authenticated
      }
      return `domain-verify:ip:${ip}`
    }
  })
}

/**
 * Security violation tracking for blocking repeat offenders.
 * Uses separate store with escalating block times.
 */
interface SecurityViolationEntry {
  count: number
  firstSeen: number
  blockedUntil: number
}

const securityStore: { [key: string]: SecurityViolationEntry } = {}

const SECURITY_WINDOW_MS = 60 * 1000          // 1 minute window
const SECURITY_MAX_VIOLATIONS = 10            // Max violations before block
const SECURITY_BLOCK_MS = 5 * 60 * 1000       // 5 minute initial block
const SECURITY_MAX_BLOCK_MS = 60 * 60 * 1000  // Max 1 hour block

// Cleanup security store periodically
setInterval(() => {
  const now = Date.now()
  const expireThreshold = now - SECURITY_WINDOW_MS - SECURITY_MAX_BLOCK_MS
  for (const key in securityStore) {
    const entry = securityStore[key]
    if (entry && entry.firstSeen < expireThreshold && entry.blockedUntil < now) {
      delete securityStore[key]
    }
  }
}, cleanupInterval)

/**
 * Record a security violation for an IP.
 * Returns true if the IP should be blocked.
 */
export function recordSecurityViolation(ip: string): boolean {
  const now = Date.now()
  let entry = securityStore[ip]

  if (!entry) {
    securityStore[ip] = {
      count: 1,
      firstSeen: now,
      blockedUntil: 0
    }
    return false
  }

  // If currently blocked, extend block
  if (entry.blockedUntil > now) {
    entry.blockedUntil = Math.min(
      entry.blockedUntil + SECURITY_BLOCK_MS,
      now + SECURITY_MAX_BLOCK_MS
    )
    return true
  }

  // Reset if window expired
  if (now - entry.firstSeen > SECURITY_WINDOW_MS) {
    entry.count = 1
    entry.firstSeen = now
    return false
  }

  // Increment count
  entry.count++

  // Check if should block
  if (entry.count >= SECURITY_MAX_VIOLATIONS) {
    // Escalate block duration for repeat offenders
    const previousBlocks = Math.floor(entry.count / SECURITY_MAX_VIOLATIONS)
    const blockDuration = Math.min(
      SECURITY_BLOCK_MS * Math.pow(2, previousBlocks - 1),
      SECURITY_MAX_BLOCK_MS
    )
    entry.blockedUntil = now + blockDuration
    return true
  }

  return false
}

/**
 * Check if an IP is currently blocked for security violations.
 */
export function isSecurityBlocked(ip: string): boolean {
  const entry = securityStore[ip]
  if (!entry) return false
  return entry.blockedUntil > Date.now()
}

/**
 * Get remaining security block time in seconds.
 */
export function getSecurityBlockRemaining(ip: string): number {
  const entry = securityStore[ip]
  if (!entry) return 0
  const remaining = entry.blockedUntil - Date.now()
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

