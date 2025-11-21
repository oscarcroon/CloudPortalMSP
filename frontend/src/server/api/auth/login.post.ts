import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { findUserByEmail, touchUserLogin, userRequiresSso } from '../../utils/auth'
import { normalizeEmail, verifyPassword } from '../../utils/crypto'
import { createSession } from '../../utils/session'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  allowPasswordFallback: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const body = loginSchema.parse(await readBody(event))
  const email = normalizeEmail(body.email)
  const user = await findUserByEmail(email)
  if (!user || !user.passwordHash) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const ssoRequired = await userRequiresSso(user.id)
  if (ssoRequired && !body.allowPasswordFallback) {
    throw createError({ statusCode: 403, message: 'Organisation requires SSO' })
  }

  const isValid = await verifyPassword(body.password, user.passwordHash)
  if (!isValid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  await touchUserLogin(user.id)
  const auth = await createSession(event, user.id)
  return auth
})

