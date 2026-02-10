import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const ISSUER = 'CloudPortal'
const TOTP_PERIOD = 30
const TOTP_DIGITS = 6
const BACKUP_CODE_COUNT = 8
const BACKUP_CODE_LENGTH = 8

/**
 * Generate a new TOTP secret and corresponding QR code data URL
 */
export async function generateTotpSecret(email: string) {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: new OTPAuth.Secret({ size: 20 })
  })

  const otpauthUri = totp.toString()
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri)

  return {
    secret: totp.secret.base32,
    otpauthUri,
    qrCodeDataUrl
  }
}

/**
 * Verify a TOTP code against a base32-encoded secret
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret)
  })

  const delta = totp.validate({ token: code, window: 1 })
  return delta !== null
}

/**
 * Generate random backup codes
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const bytes = crypto.randomBytes(BACKUP_CODE_LENGTH)
    const code = bytes.toString('hex').slice(0, BACKUP_CODE_LENGTH).toUpperCase()
    codes.push(code)
  }
  return codes
}

/**
 * Hash a single backup code with bcrypt
 */
export async function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(code.toUpperCase(), 10)
}

/**
 * Verify a backup code against a list of hashed codes.
 * Returns the validity and the remaining codes (with the used one removed).
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; remainingCodes: string[] }> {
  const normalizedCode = code.toUpperCase()

  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(normalizedCode, hashedCodes[i])
    if (match) {
      const remainingCodes = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)]
      return { valid: true, remainingCodes }
    }
  }

  return { valid: false, remainingCodes: hashedCodes }
}
