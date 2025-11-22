import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { EncryptedPayload } from './types.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

const HEX_64 = /^[a-f0-9]{64}$/i

export class EmailCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailCryptoError'
  }
}

function resolveKey(secret: string): Buffer {
  const trimmed = secret?.trim()
  if (!trimmed) {
    throw new EmailCryptoError('Missing EMAIL_CRYPTO_KEY.')
  }

  const attempts: Array<{ buffer: Buffer; valid: boolean }> = []

  if (HEX_64.test(trimmed)) {
    const buffer = Buffer.from(trimmed, 'hex')
    attempts.push({ buffer, valid: buffer.length === 32 })
  } else {
    try {
      const buffer = Buffer.from(trimmed, 'base64')
      attempts.push({ buffer, valid: buffer.length === 32 })
    } catch {
      // ignore
    }
  }

  const utf8 = Buffer.from(trimmed, 'utf8')
  attempts.push({ buffer: utf8, valid: utf8.length === 32 })

  const hit = attempts.find((entry) => entry.valid)
  if (hit) {
    return hit.buffer
  }
  throw new EmailCryptoError('EMAIL_CRYPTO_KEY must resolve to 32 bytes (256 bits).')
}

export function encryptConfig<T>(value: T, secret: string): EncryptedPayload {
  const key = resolveKey(secret)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const payload = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    cipherText: payload.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  }
}

export function decryptConfig<T>(payload: EncryptedPayload, secret: string): T {
  const key = resolveKey(secret)
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, 'base64')),
    decipher.final()
  ])
  return JSON.parse(decrypted.toString('utf8')) as T
}

