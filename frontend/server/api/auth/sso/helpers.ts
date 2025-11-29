import { $fetch } from 'ofetch'
import type { SanitizedOidcConfig } from '~~/server/utils/idp'

export interface OidcMetadata {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
  issuer: string
}

export interface OidcTokenResponse {
  access_token: string
  id_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

const buildMetadataUrl = (config: SanitizedOidcConfig) =>
  config.metadataUrl ?? `${config.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`

export const fetchOidcMetadata = (config: SanitizedOidcConfig) => {
  return $fetch<OidcMetadata>(buildMetadataUrl(config))
}

export const exchangeCodeForTokens = async (
  metadata: OidcMetadata,
  config: SanitizedOidcConfig,
  code: string,
  codeVerifier: string
) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier
  })

  if (config.clientSecret) {
    body.append('client_secret', config.clientSecret)
  }

  return $fetch<OidcTokenResponse>(metadata.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })
}

export const fetchUserInfo = async (endpoint: string, accessToken: string) => {
  return $fetch<Record<string, unknown>>(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })
}

const base64UrlDecode = (segment: string) => {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? normalized : normalized + '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(pad, 'base64').toString('utf8')
}

export const decodeIdToken = (token: string) => {
  const parts = token.split('.')
  if (parts.length < 2) {
    throw new Error('Ogiltigt ID-token')
  }
  const payload = base64UrlDecode(parts[1])
  return JSON.parse(payload) as Record<string, unknown>
}


