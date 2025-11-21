import { useRuntimeConfig } from '#imports'
import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { buildAuthState } from '../../utils/auth'
import { decodeSessionToken } from '../../utils/session'

interface IntrospectBody {
  token?: string
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const expected = config.auth?.serviceToken
  if (expected) {
    const provided = getHeader(event, 'x-service-token')
    if (provided !== expected) {
      throw createError({ statusCode: 403, message: 'Invalid service token' })
    }
  }

  const body = (await readBody(event)) as IntrospectBody
  const token = body?.token
  if (!token) {
    throw createError({ statusCode: 400, message: 'token missing' })
  }

  const payload = decodeSessionToken(token)
  const auth = await buildAuthState(payload.userId, payload.currentOrgId, payload.orgRoles)
  return auth
})

