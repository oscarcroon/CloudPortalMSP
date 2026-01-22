/**
 * API Token Utilities
 *
 * Provides functions for creating and verifying org API tokens.
 * Token format: msp_pat.<prefix>.<secret>
 *
 * - prefix: 16 chars, base32 (A-Z, 2-7), globally unique
 * - secret: 32 bytes random, base64url encoded
 * - Hash: scrypt(secret, salt, pepper)
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { getKeyProvider } from '../keys/EnvKeyProvider'

// ============================================================================
// Constants
// ============================================================================

export const TOKEN_PREFIX_SCHEME = 'msp_pat'
export const PREFIX_LENGTH = 16
export const SECRET_BYTES = 32
export const HASH_KEY_LENGTH = 64

// scrypt parameters (recommended for high security)
export const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost
  r: 8, // Block size
  p: 1, // Parallelization
  keylen: HASH_KEY_LENGTH,
}

// Base32 alphabet (RFC 4648, no padding)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// ============================================================================
// Types
// ============================================================================

export interface TokenCreateResult {
  /** Full token string to give to user (only shown once) */
  plaintext: string
  /** Prefix for DB lookup */
  prefix: string
  /** Salt (base64) */
  salt: string
  /** Hash of secret (base64) */
  tokenHash: string
  /** Hash algorithm identifier */
  hashAlg: string
  /** Hash version */
  hashVersion: number
  /** Hash parameters (JSON) */
  hashParams: string
  /** Pepper key ID used */
  pepperKid: string
}

export interface TokenParseResult {
  /** Token prefix for DB lookup */
  prefix: string
  /** Secret portion (base64url) */
  secret: string
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a random base32 string of given length
 */
function randomBase32(length: number): string {
  const bytes = randomBytes(Math.ceil((length * 5) / 8))
  let result = ''
  let bits = 0
  let value = 0

  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      bits -= 5
      result += BASE32_ALPHABET[(value >> bits) & 0x1f]
      if (result.length >= length) break
    }
    if (result.length >= length) break
  }

  return result.slice(0, length)
}

/**
 * Hash a secret using scrypt with salt and pepper
 */
async function hashSecret(
  secret: Buffer,
  salt: Buffer,
  pepper: string
): Promise<Buffer> {
  // Combine secret with pepper
  const input = Buffer.concat([secret, Buffer.from(pepper, 'utf8')])

  return new Promise((resolve, reject) => {
    scrypt(
      input,
      salt,
      SCRYPT_PARAMS.keylen,
      {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p,
      },
      (err, derivedKey) => {
        if (err) reject(err)
        else resolve(derivedKey)
      }
    )
  })
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Create a new API token
 *
 * @returns Token creation result with plaintext (shown once) and hash for storage
 */
export async function createApiToken(): Promise<TokenCreateResult> {
  const keyProvider = getKeyProvider()
  const pepper = await keyProvider.getCurrentPepper()

  // Generate prefix and secret
  const prefix = randomBase32(PREFIX_LENGTH)
  const secretBytes = randomBytes(SECRET_BYTES)
  const secret = secretBytes.toString('base64url')

  // Generate salt
  const saltBytes = randomBytes(16)
  const salt = saltBytes.toString('base64')

  // Hash the secret
  const hashBuffer = await hashSecret(secretBytes, saltBytes, pepper.secret)
  const tokenHash = hashBuffer.toString('base64')

  // Build plaintext token
  const plaintext = `${TOKEN_PREFIX_SCHEME}.${prefix}.${secret}`

  return {
    plaintext,
    prefix,
    salt,
    tokenHash,
    hashAlg: 'scrypt-v1',
    hashVersion: 1,
    hashParams: JSON.stringify({
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
      keylen: SCRYPT_PARAMS.keylen,
    }),
    pepperKid: pepper.kid,
  }
}

/**
 * Parse a token string into its components
 *
 * @param token - Full token string (msp_pat.<prefix>.<secret>)
 * @returns Parsed token or null if invalid format
 */
export function parseApiToken(token: string): TokenParseResult | null {
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [scheme, prefix, secret] = parts

  // Validate scheme
  if (scheme !== TOKEN_PREFIX_SCHEME) return null

  // Validate prefix (base32, correct length)
  if (prefix.length !== PREFIX_LENGTH) return null
  if (!/^[A-Z2-7]+$/.test(prefix)) return null

  // Validate secret (base64url, reasonable length)
  if (!secret || secret.length < 20) return null
  if (!/^[A-Za-z0-9_-]+$/.test(secret)) return null

  return { prefix, secret }
}

/**
 * Verify a token secret against a stored hash
 *
 * @param secret - Secret portion of the token (base64url)
 * @param storedHash - Stored hash (base64)
 * @param salt - Salt used for hashing (base64)
 * @param pepperKid - Pepper key ID used for hashing
 * @returns True if token is valid
 */
export async function verifyApiToken(
  secret: string,
  storedHash: string,
  salt: string,
  pepperKid: string
): Promise<boolean> {
  const keyProvider = getKeyProvider()

  // Get peppers for verification (current + legacy)
  const peppers = await keyProvider.getAllPeppersForVerification(pepperKid)

  if (peppers.length === 0) {
    console.warn(`No pepper found for kid: ${pepperKid}`)
    return false
  }

  // Decode inputs
  const secretBytes = Buffer.from(secret, 'base64url')
  const saltBytes = Buffer.from(salt, 'base64')
  const storedHashBytes = Buffer.from(storedHash, 'base64')

  // Try each pepper (usually just one unless mid-rotation)
  for (const pepper of peppers) {
    try {
      const hashBuffer = await hashSecret(secretBytes, saltBytes, pepper.secret)

      // Timing-safe comparison
      if (
        hashBuffer.length === storedHashBytes.length &&
        timingSafeEqual(hashBuffer, storedHashBytes)
      ) {
        return true
      }
    } catch {
      // Continue to next pepper
    }
  }

  return false
}

/**
 * Check if a token string looks like an API token (vs JWT)
 */
export function looksLikeApiToken(token: string): boolean {
  return token.startsWith(`${TOKEN_PREFIX_SCHEME}.`)
}

