import { H3Event, createError } from 'h3'
import { ensureAuthState } from '../utils/session'
import { getClientIP } from './ip'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (event: H3Event) => string // Custom key generator
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
    if (store[key].resetTime < now) {
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
      ? config.keyGenerator(event)
      : getDefaultKey(event)

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
  })
}

