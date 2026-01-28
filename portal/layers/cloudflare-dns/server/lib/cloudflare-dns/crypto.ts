import crypto from 'node:crypto'

const deriveKey = (rawKey: string) => crypto.createHash('sha256').update(rawKey).digest()

const getDevFallbackKey = () => {
  const seed = process.cwd()
  console.warn(
    '[cloudflare-dns] CLOUDFLARE_CRYPTO_KEY saknas – använder en temporär utvecklingsnyckel. Sätt CLOUDFLARE_CRYPTO_KEY i .env innan produktion.'
  )
  return deriveKey(seed)
}

const ensureCryptoKey = () => {
  const raw = process.env.CLOUDFLARE_CRYPTO_KEY
  if (!raw) {
    if (process.env.NODE_ENV !== 'production') {
      return getDevFallbackKey()
    }
    throw new Error('CLOUDFLARE_CRYPTO_KEY saknas.')
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


