/**
 * DNS Challenge Token — HMAC-SHA256 signed, run-scoped, short-lived.
 *
 * Used to authenticate DNS-01 challenge requests from the agent's
 * PowerShell scripts. Scoped to a specific run + lease + DNS zone.
 *
 * Format: base64url(JSON payload).hmac_signature
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes
const HMAC_CONTEXT = 'dns-challenge'

export interface DnsChallengePayload {
  runId: string
  leaseId: string
  agentId: string
  orgId: string
  provider: string
  zoneId: string
  exp: number
}

/**
 * Derive a signing key from the crypto key using HMAC context separation.
 */
function deriveKey(cryptoKey: string): string {
  return createHmac('sha256', cryptoKey).update(HMAC_CONTEXT).digest('hex')
}

/**
 * Get the signing key from environment.
 * Prefers CERTIFICATES_CRYPTO_KEY; falls back to AUTH_JWT_SECRET with warning.
 */
function getSigningKey(): string {
  const dedicated = process.env.CERTIFICATES_CRYPTO_KEY
  if (dedicated) return dedicated

  const fallback = process.env.AUTH_JWT_SECRET
  if (fallback) {
    console.warn('[dns-challenge-token] CERTIFICATES_CRYPTO_KEY not set — falling back to AUTH_JWT_SECRET')
    return fallback
  }

  throw new Error('Neither CERTIFICATES_CRYPTO_KEY nor AUTH_JWT_SECRET is configured')
}

/**
 * Generate a short-lived challenge token scoped to a specific run + lease + DNS zone.
 * NOTE: zoneName is NOT in the token — looked up from provider at validation time.
 */
export function generateDnsChallengeToken(params: {
  runId: string
  leaseId: string
  agentId: string
  orgId: string
  provider: string
  zoneId: string
}): string {
  const key = deriveKey(getSigningKey())

  const payload: DnsChallengePayload = {
    runId: params.runId,
    leaseId: params.leaseId,
    agentId: params.agentId,
    orgId: params.orgId,
    provider: params.provider,
    zoneId: params.zoneId,
    exp: Date.now() + TOKEN_TTL_MS
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', key).update(payloadB64).digest('hex')

  return `${payloadB64}.${signature}`
}

/**
 * Validate and decode a challenge token.
 * Returns payload or null if invalid/expired.
 * Uses timing-safe comparison.
 */
export function validateDnsChallengeToken(token: string): DnsChallengePayload | null {
  if (!token || typeof token !== 'string') return null

  const dotIndex = token.lastIndexOf('.')
  if (dotIndex === -1) return null

  const payloadB64 = token.slice(0, dotIndex)
  const signature = token.slice(dotIndex + 1)
  if (!payloadB64 || !signature) return null

  // Verify HMAC signature with timing-safe comparison
  const key = deriveKey(getSigningKey())
  const expectedSignature = createHmac('sha256', key).update(payloadB64).digest('hex')

  try {
    const sigBuf = Buffer.from(signature, 'hex')
    const expectedBuf = Buffer.from(expectedSignature, 'hex')
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null
  } catch {
    return null
  }

  // Decode payload
  let payload: DnsChallengePayload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'))
  } catch {
    return null
  }

  // Check expiration
  if (!payload.exp || Date.now() > payload.exp) return null

  // Verify required fields
  if (!payload.runId || !payload.leaseId || !payload.agentId || !payload.orgId || !payload.provider || !payload.zoneId) {
    return null
  }

  return payload
}
