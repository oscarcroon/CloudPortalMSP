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
import {
  createPkceChallenge,
  generateNonce,
  sanitizeRedirectTarget,
  storeSsoState
} from '~~/server/utils/sso'
import { fetchOidcMetadata } from '../helpers'

export default defineEventHandler(async (event) => {
  const orgSlug = getRouterParam(event, 'orgSlug')
  if (!orgSlug) {
    throw createError({ statusCode: 400, message: 'Saknar organisationsslug.' })
  }

  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgSlug)
  const authSettings = await ensureOrganizationAuthSettings(db, organization.id)
  const parsedConfig = parseIdpConfigString(authSettings.idpConfig)
  const oidcConfig = ensureActiveOidcConfig(authSettings.idpType as any, parsedConfig)
  const metadata = await fetchOidcMetadata(oidcConfig)

  const { verifier, challenge } = createPkceChallenge()
  const nonce = generateNonce()
  const state = generateNonce()
  const query = getQuery(event)
  const redirect = sanitizeRedirectTarget(query.redirect)

  storeSsoState(event, {
    state,
    codeVerifier: verifier,
    nonce,
    orgId: organization.id,
    slug: organization.slug,
    redirect
  })

  const authorizeUrl = new URL(metadata.authorization_endpoint)
  authorizeUrl.searchParams.set('client_id', oidcConfig.clientId)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('redirect_uri', oidcConfig.redirectUri)
  authorizeUrl.searchParams.set('scope', oidcConfig.scopes || 'openid email profile')
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('nonce', nonce)
  authorizeUrl.searchParams.set('code_challenge', challenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')

  return sendRedirect(event, authorizeUrl.toString(), 302)
})

