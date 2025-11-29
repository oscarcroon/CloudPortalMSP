import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { findUserByEmail, touchUserLogin, userRequiresSso } from '../../utils/auth'
import { normalizeEmail, verifyPassword } from '../../utils/crypto'
import { createSession } from '../../utils/session'
import { logSecurityEvent } from '../../utils/audit'

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
    await logSecurityEvent(event, 'LOGIN_FAILED', {
      email,
      reason: 'user_not_found'
    })
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  if (user.status !== 'active') {
    await logSecurityEvent(event, 'LOGIN_FAILED', {
      email,
      reason: 'account_disabled',
      userId: user.id
    }, {
      userId: user.id
    })
    throw createError({ statusCode: 403, message: 'Kontot är inaktiverat.' })
  }

  const ssoRequired = await userRequiresSso(user.id)
  if (ssoRequired && !body.allowPasswordFallback) {
    await logSecurityEvent(event, 'LOGIN_FAILED', {
      email,
      reason: 'sso_required',
      userId: user.id
    }, {
      userId: user.id
    })
    throw createError({ statusCode: 403, message: 'Organisation requires SSO' })
  }

  const isValid = await verifyPassword(body.password, user.passwordHash)
  if (!isValid) {
    await logSecurityEvent(event, 'LOGIN_FAILED', {
      email,
      reason: 'wrong_password',
      userId: user.id
    }, {
      userId: user.id
    })
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  await touchUserLogin(user.id)
  const auth = await createSession(event, user.id)
  
  // Log successful login
  await logSecurityEvent(event, 'LOGIN_SUCCESS', {
    email,
    userId: user.id
  }, {
    userId: user.id,
    orgId: auth.currentOrgId || undefined,
    tenantId: auth.currentTenantId || undefined
  })
  
  return auth
})

