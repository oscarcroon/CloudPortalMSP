import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12)

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export const verifyPassword = async (password: string, passwordHash: string | null) => {
  if (!passwordHash) {
    return false
  }
  return bcrypt.compare(password, passwordHash)
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const createInviteToken = () => randomBytes(32).toString('hex')

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

