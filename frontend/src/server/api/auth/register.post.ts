import { useRuntimeConfig } from '#imports'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { findUserByEmail, createUserWithOrganization } from '../../utils/auth'
import { hashPassword, normalizeEmail } from '../../utils/crypto'
import { createSession } from '../../utils/session'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(120).optional(),
  organizationName: z.string().min(2).max(120)
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.auth?.allowSelfRegistration) {
    throw createError({
      statusCode: 403,
      message: 'Self-service registration is disabled'
    })
  }

  const body = registerSchema.parse(await readBody(event))
  const email = normalizeEmail(body.email)
  const existing = await findUserByEmail(email)
  if (existing) {
    throw createError({ statusCode: 409, message: 'User already exists' })
  }

  const passwordHash = await hashPassword(body.password)
  const { userId } = await createUserWithOrganization({
    email,
    passwordHash,
    fullName: body.fullName,
    organizationName: body.organizationName
  })

  const auth = await createSession(event, userId)
  return auth
})

