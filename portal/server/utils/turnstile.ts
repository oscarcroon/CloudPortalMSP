import type { H3Event } from 'h3'
import { createError } from 'h3'
import { getClientIP } from './ip'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * - If no secret key is configured, verification is skipped (dev-friendly).
 * - If the secret key exists but the token is missing → 400.
 * - If verification fails → 403.
 * - If the Cloudflare API is unreachable → 503 in production, fail-open in dev.
 */
export async function requireTurnstileToken(event: H3Event, token?: string): Promise<void> {
  const secretKey = process.env.NUXT_TURNSTILE_SECRET_KEY || ''

  // No secret key configured → skip verification (dev mode)
  if (!secretKey) {
    return
  }

  // Secret key exists but no token provided → reject
  if (!token) {
    throw createError({
      statusCode: 400,
      message: 'Turnstile token is required'
    })
  }

  const clientIp = getClientIP(event) || undefined

  try {
    const result = await $fetch<{ success: boolean; 'error-codes'?: string[] }>(SITEVERIFY_URL, {
      method: 'POST',
      body: {
        secret: secretKey,
        response: token,
        ...(clientIp && { remoteip: clientIp })
      }
    })

    if (!result.success) {
      throw createError({
        statusCode: 403,
        message: 'Turnstile verification failed'
      })
    }
  } catch (error: any) {
    // If it's already an H3 error we threw, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Cloudflare API unreachable
    const isProd = process.env.NODE_ENV === 'production'
    if (isProd) {
      throw createError({
        statusCode: 503,
        message: 'Captcha verification service unavailable'
      })
    }
    // Dev: fail-open
    console.warn('[turnstile] Verification request failed, failing open in dev mode:', error.message)
  }
}
