/**
 * Certificates Layer Encryption
 *
 * AES-256-GCM for encrypting ACME credential secrets (EAB HMAC).
 * Uses CERTIFICATES_CRYPTO_KEY env var, with dev fallback.
 */

import crypto from 'node:crypto'

const deriveKey = (rawKey: string) => crypto.createHash('sha256').update(rawKey).digest()

const getDevFallbackKey = () => {
  const seed = process.cwd()
  console.warn(
    '[certificates] CERTIFICATES_CRYPTO_KEY missing — using a temporary dev key. Set CERTIFICATES_CRYPTO_KEY in .env before production.'
  )
  return deriveKey(seed)
}

const ensureCryptoKey = () => {
  const raw = process.env.CERTIFICATES_CRYPTO_KEY
  if (!raw) {
    if (process.env.NODE_ENV !== 'production') {
      return getDevFallbackKey()
    }
    throw new Error('CERTIFICATES_CRYPTO_KEY is required in production.')
  }
  return deriveKey(raw)
}

export const encryptSecret = (plainText: string) => {
  const key = ensureCryptoKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  }
}

export const decryptSecret = (payload: {
  cipherText: string
  iv: string
  authTag: string
}) => {
  const key = ensureCryptoKey()
  const iv = Buffer.from(payload.iv, 'base64')
  const authTag = Buffer.from(payload.authTag, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, 'base64')),
    decipher.final()
  ])
  return decrypted.toString('utf8')
}

export const maskSecret = (secret?: string | null) => {
  if (!secret) return ''
  if (secret.length <= 4) return '••••'
  return `••••${secret.slice(-4)}`
}
