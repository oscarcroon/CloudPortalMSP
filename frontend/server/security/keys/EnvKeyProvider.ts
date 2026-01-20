/**
 * EnvKeyProvider
 *
 * KeyProvider implementation that reads peppers from environment variables.
 * This is the default provider for development and simple deployments.
 *
 * Environment variables:
 * - TOKEN_PEPPER_CURRENT: Current pepper for minting new tokens (required in production)
 * - TOKEN_PEPPER_LEGACY_JSON: Optional JSON array of legacy peppers for verification
 *
 * Example TOKEN_PEPPER_LEGACY_JSON:
 * [{"kid":"env-v1","secret":"old-pepper-1"},{"kid":"env-v2","secret":"old-pepper-2"}]
 */

import type { KeyProvider, PepperInfo } from './KeyProvider'
import { DEFAULT_PEPPER_KID } from './KeyProvider'

// Cache for peppers (with TTL)
interface CacheEntry {
  peppers: PepperInfo[]
  expiresAt: number
}

let cache: CacheEntry | null = null
const CACHE_TTL_MS = 60_000 // 1 minute cache

// Default development pepper (NEVER use in production)
const DEV_PEPPER = 'dev-pepper-change-me-in-production'

export class EnvKeyProvider implements KeyProvider {
  private getConfig() {
    // Try to get from Nuxt runtime config if available
    const runtime = (globalThis as any)?.useRuntimeConfig?.()
    return {
      currentPepper: runtime?.auth?.tokenPepper || process.env.TOKEN_PEPPER_CURRENT,
      legacyPeppersJson: runtime?.auth?.tokenPepperLegacy || process.env.TOKEN_PEPPER_LEGACY_JSON,
    }
  }

  async getCurrentPepper(): Promise<PepperInfo> {
    const config = this.getConfig()
    const isProd = process.env.NODE_ENV === 'production'

    // In production, pepper is required
    if (isProd && !config.currentPepper) {
      throw new Error('TOKEN_PEPPER_CURRENT is required in production')
    }

    // In development, use a default pepper (with warning)
    const secret = config.currentPepper || DEV_PEPPER
    if (!config.currentPepper) {
      console.warn(
        'Warning: Using default dev pepper. Set TOKEN_PEPPER_CURRENT in production.'
      )
    }

    return {
      kid: DEFAULT_PEPPER_KID,
      secret,
    }
  }

  async getAllPeppersForVerification(kid?: string): Promise<PepperInfo[]> {
    // Check cache
    const now = Date.now()
    if (cache && cache.expiresAt > now) {
      if (kid) {
        return cache.peppers.filter((p) => p.kid === kid)
      }
      return cache.peppers
    }

    // Build pepper list
    const peppers: PepperInfo[] = []
    const config = this.getConfig()

    // Add current pepper
    const current = await this.getCurrentPepper()
    peppers.push(current)

    // Add legacy peppers if configured
    if (config.legacyPeppersJson) {
      try {
        const legacy = JSON.parse(config.legacyPeppersJson) as PepperInfo[]
        if (Array.isArray(legacy)) {
          for (const p of legacy) {
            if (p.kid && p.secret && p.kid !== current.kid) {
              peppers.push(p)
            }
          }
        }
      } catch (error) {
        console.error('Failed to parse TOKEN_PEPPER_LEGACY_JSON:', error)
      }
    }

    // Update cache
    cache = {
      peppers,
      expiresAt: now + CACHE_TTL_MS,
    }

    // Filter by kid if requested
    if (kid) {
      return peppers.filter((p) => p.kid === kid)
    }

    return peppers
  }
}

/**
 * Singleton instance of the env key provider
 */
let instance: EnvKeyProvider | null = null

export function getKeyProvider(): KeyProvider {
  if (!instance) {
    instance = new EnvKeyProvider()
  }
  return instance
}

