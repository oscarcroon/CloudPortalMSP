import { createHmac, randomBytes, createHash } from 'node:crypto'
import { createError, deleteCookie, getCookie, H3Event, setCookie } from 'h3'

const SSO_STATE_COOKIE = 'sso_state_v1'

const base64UrlEncode = (input: Buffer | string) =>
  (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const getRuntime = () => {
  const runtime = (globalThis as any)?.useRuntimeConfig?.()
  return runtime ?? {}
}

const getStateSecret = () => {
  const runtime = getRuntime()
  return (
    runtime.auth?.jwtSecret ??
    process.env.AUTH_JWT_SECRET ??
    process.env.SSO_STATE_SECRET ??
    'dev-sso-secret'
  )
}

interface StoredSsoState {
  state: string
  codeVerifier: string
  nonce: string
  orgId: string
  slug: string
  redirect?: string
}

const toBase64 = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? normalized : normalized + '='.repeat(4 - (normalized.length % 4))
  return pad
}

const signPayload = (encoded: string) =>
  base64UrlEncode(createHmac('sha256', getStateSecret()).update(encoded).digest())

const encodeState = (payload: StoredSsoState) => {
  const encoded = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encoded)
  return `${encoded}.${signature}`
}

const decodeState = (value: string): StoredSsoState => {
  const [encoded, signature] = value.split('.')
  if (!encoded || !signature) {
    throw createError({ statusCode: 400, message: 'Ogiltig SSO-state' })
  }
  const expected = signPayload(encoded)
  if (expected !== signature) {
    throw createError({ statusCode: 400, message: 'SSO-state kunde inte verifieras.' })
  }
  const json = Buffer.from(toBase64(encoded), 'base64').toString('utf8')
  return JSON.parse(json)
}

export const storeSsoState = (event: H3Event, payload: StoredSsoState) => {
  setCookie(event, SSO_STATE_COOKIE, encodeState(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/sso',
    maxAge: 60 * 5
  })
}

export const consumeSsoState = (event: H3Event): StoredSsoState => {
  const raw = getCookie(event, SSO_STATE_COOKIE)
  if (!raw) {
    throw createError({ statusCode: 400, message: 'Saknar SSO-state (cookie).' })
  }
  deleteCookie(event, SSO_STATE_COOKIE, { path: '/api/auth/sso' })
  return decodeState(raw)
}

export const createPkceChallenge = () => {
  const verifier = base64UrlEncode(randomBytes(48))
  const challenge = base64UrlEncode(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export const generateNonce = () => base64UrlEncode(randomBytes(24))

export const sanitizeRedirectTarget = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }
  if (!value.startsWith('/') || value.startsWith('//')) {
    return undefined
  }
  return value
}

