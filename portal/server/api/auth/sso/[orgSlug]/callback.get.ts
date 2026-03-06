import { createError, defineEventHandler, getQuery, getRouterParam, sendRedirect } from 'h3'
import { getDb } from '~~/server/utils/db'
import {
  ensureOrganizationAuthSettings,
  requireOrganizationByIdentifier
} from '../../../admin/organizations/utils'
import {
  ensureActiveOidcConfig,
  parseIdpConfigString
} from '~~/server/utils/idp'
import { consumeSsoState } from '~~/server/utils/sso'
import {
  decodeIdToken,
  exchangeCodeForTokens,
  fetchOidcMetadata,
  fetchUserInfo
} from '../helpers'
import {
  createUserForOrganization,
  ensureMembershipOrCreate,
  findUserByEmail
} from '~~/server/utils/auth'
import { normalizeEmail } from '~~/server/utils/crypto'
import { createSession } from '~~/server/utils/session'
import { users } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'
import type { RbacRole } from '~/constants/rbac'

const extractEmail = (profile: Record<string, unknown>) => {
  const candidates = ['email', 'preferred_username', 'upn']
  for (const key of candidates) {
    const value = profile[key]
    if (typeof value === 'string' && value.length > 3) {
      return normalizeEmail(value)
    }
  }
  return null
}

const extractFullName = (profile: Record<string, unknown>) => {
  if (typeof profile.name === 'string') {
    return profile.name
  }
  if (typeof profile.full_name === 'string') {
    return profile.full_name
  }
  if (typeof profile.given_name === 'string' || typeof profile.family_name === 'string') {
    return [profile.given_name, profile.family_name].filter(Boolean).join(' ').trim()
  }
  return undefined
}

const extractProfilePicture = (profile: Record<string, unknown>): string | undefined => {
  if (typeof profile.picture === 'string' && profile.picture.length > 0) return profile.picture
  if (typeof profile.photo === 'string' && profile.photo.length > 0) return profile.photo
  return undefined
}

export default defineEventHandler(async (event) => {
  const orgSlug = getRouterParam(event, 'orgSlug')
  if (!orgSlug) {
    throw createError({ statusCode: 400, message: 'Saknar organisationsslug.' })
  }

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : null
  const stateParam = typeof query.state === 'string' ? query.state : null
  if (!code || !stateParam) {
    throw createError({ statusCode: 400, message: 'Saknar parametrar från IdP.' })
  }

  const storedState = consumeSsoState(event)
  if (stateParam !== storedState.state) {
    throw createError({ statusCode: 400, message: 'State matchade inte.' })
  }
  if (storedState.slug !== orgSlug) {
    throw createError({ statusCode: 400, message: 'Fel organisation för denna callback.' })
  }

  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgSlug)
  if (organization.id !== storedState.orgId) {
    throw createError({ statusCode: 400, message: 'Organisationen ändrades under flödet.' })
  }

  const authSettings = await ensureOrganizationAuthSettings(db, organization.id)
  const parsedConfig = parseIdpConfigString(authSettings.idpConfig)
  const oidcConfig = ensureActiveOidcConfig(authSettings.idpType as any, parsedConfig)
  const metadata = await fetchOidcMetadata(oidcConfig)
  const tokenResponse = await exchangeCodeForTokens(metadata, oidcConfig, code, storedState.codeVerifier)
  if (!tokenResponse.access_token) {
    throw createError({ statusCode: 400, message: 'IdP returnerade inget access token.' })
  }

  let profile: Record<string, unknown> = {}
  if (metadata.userinfo_endpoint) {
    try {
      profile = await fetchUserInfo(metadata.userinfo_endpoint, tokenResponse.access_token)
    } catch {
      profile = {}
    }
  }

  let idTokenPayload: Record<string, unknown> | null = null
  if (!Object.keys(profile).length && tokenResponse.id_token) {
    idTokenPayload = decodeIdToken(tokenResponse.id_token)
    profile = idTokenPayload
  }

  if (idTokenPayload && typeof idTokenPayload.nonce === 'string') {
    if (idTokenPayload.nonce !== storedState.nonce) {
      throw createError({ statusCode: 400, message: 'Nonce matchade inte.' })
    }
  }

  const email = extractEmail(profile)
  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'IdP svarade utan e-postadress. Lägg till claim email/preferred_username.'
    })
  }

  const fullName = extractFullName(profile)
  const profilePictureUrl = extractProfilePicture(profile)
  let user = await findUserByEmail(email)
  if (!user) {
    const result = await createUserForOrganization({
      email,
      fullName,
      profilePictureUrl,
      organizationId: organization.id,
      role: organization.defaultRole as RbacRole
    })
    user = await findUserByEmail(email)
    if (!user) {
      throw createError({ statusCode: 500, message: 'Kunde inte skapa användare via SSO.' })
    }
  }

  await ensureMembershipOrCreate(
    user.id,
    organization.id,
    organization.defaultRole as RbacRole
  )

  // Update profile from IDP on every SSO login
  const profileUpdates: Record<string, unknown> = {}
  if (fullName && fullName !== user.fullName) profileUpdates.fullName = fullName
  if (profilePictureUrl && profilePictureUrl !== user.profilePictureUrl) {
    profileUpdates.profilePictureUrl = profilePictureUrl
    profileUpdates.avatarPreference = 'sso'
  }
  if (Object.keys(profileUpdates).length > 0) {
    await db.update(users).set(profileUpdates).where(eq(users.id, user.id))
  }

  await createSession(event, user.id, organization.id)
  const target = storedState.redirect ?? '/'
  return sendRedirect(event, target, 302)
})

