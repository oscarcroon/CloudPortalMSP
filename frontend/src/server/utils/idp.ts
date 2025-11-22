import { createError } from 'h3'
import { z } from 'zod'
import type { OrganizationIdpType } from '~/types/admin'

const oidcProviderValues = ['openid', 'entra'] as const
export type OidcProvider = (typeof oidcProviderValues)[number]

const baseOidcSchema = z.object({
  clientId: z.string().min(1, 'clientId krävs'),
  clientSecret: z.string().min(1, 'clientSecret krävs'),
  redirectUri: z.string().url('redirectUri måste vara en giltig URL'),
  scopes: z.string().optional()
})

const openidSchema = baseOidcSchema.extend({
  provider: z.literal('openid'),
  issuer: z.string().url('issuer måste vara en giltig URL'),
  metadataUrl: z.string().url().optional()
})

const entraSchema = baseOidcSchema.extend({
  provider: z.literal('entra'),
  tenantId: z.string().min(1, 'tenantId krävs'),
  issuer: z.string().url().optional(),
  metadataUrl: z.string().url().optional()
})

const oidcSchema = z.discriminatedUnion('provider', [openidSchema, entraSchema])

export type SanitizedOidcConfig = z.infer<typeof oidcSchema> & {
  issuer: string
  metadataUrl?: string
}

const ensureEntraDefaults = (config: z.infer<typeof entraSchema>): SanitizedOidcConfig => {
  const issuer =
    config.issuer ?? `https://login.microsoftonline.com/${config.tenantId}/v2.0`
  const metadataUrl = config.metadataUrl ?? `${issuer}/.well-known/openid-configuration`
  return {
    ...config,
    issuer,
    metadataUrl
  }
}

export const prepareIdpConfigForStorage = (
  idpType: OrganizationIdpType | undefined,
  rawConfig: unknown
): Record<string, unknown> | null => {
  if (!idpType || idpType === 'none') {
    return null
  }

  if (idpType === 'oidc') {
    if (!rawConfig) {
      throw createError({
        statusCode: 400,
        message: 'OidC-konfiguration krävs när IdP-typ är satt till OIDC.'
      })
    }
    const parsed = oidcSchema.parse(rawConfig)
    if (parsed.provider === 'entra') {
      return ensureEntraDefaults(parsed)
    }
    return parsed
  }

  if (idpType === 'saml') {
    if (!rawConfig || typeof rawConfig !== 'object') {
      throw createError({
        statusCode: 400,
        message: 'SAML-konfigurationen måste vara ett objekt.'
      })
    }
    return rawConfig as Record<string, unknown>
  }

  throw createError({
    statusCode: 400,
    message: `IdP-typen ${idpType} stöds inte.`
  })
}

export const parseIdpConfigString = (value: string | null) => {
  if (!value) return null
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

export const ensureActiveOidcConfig = (
  idpType: OrganizationIdpType | undefined,
  config: Record<string, unknown> | null
): SanitizedOidcConfig => {
  if (idpType !== 'oidc' || !config) {
    throw createError({
      statusCode: 400,
      message: 'Organisationen saknar en OIDC-konfiguration.'
    })
  }
  const parsed = oidcSchema.parse(config)
  return parsed.provider === 'entra' ? ensureEntraDefaults(parsed) : parsed
}

export const hasConfiguredIdp = (
  idpType: OrganizationIdpType | undefined,
  config: unknown
) => {
  if (!idpType || idpType === 'none') {
    return false
  }
  if (idpType === 'oidc') {
    if (!config || typeof config !== 'object') {
      return false
    }
    const provider = (config as Record<string, unknown>).provider
    if (provider !== 'openid' && provider !== 'entra') {
      return false
    }
    const issuer = (config as Record<string, unknown>).issuer
    const clientId = (config as Record<string, unknown>).clientId
    const clientSecret = (config as Record<string, unknown>).clientSecret
    const redirectUri = (config as Record<string, unknown>).redirectUri
    return (
      typeof issuer === 'string' &&
      typeof clientId === 'string' &&
      typeof clientSecret === 'string' &&
      typeof redirectUri === 'string' &&
      issuer.length > 0 &&
      clientId.length > 0 &&
      clientSecret.length > 0 &&
      redirectUri.length > 0
    )
  }

  return Boolean(config)
}

export const assertRequireSsoAllowed = (options: {
  requireSso: boolean | undefined
  idpType: OrganizationIdpType | undefined
  idpConfig: Record<string, unknown> | null | undefined
}) => {
  if (!options.requireSso) {
    return
  }
  if (!hasConfiguredIdp(options.idpType, options.idpConfig ?? null)) {
    throw createError({
      statusCode: 400,
      message: 'Konfigurera en Identity Provider innan SSO kan krävas.'
    })
  }
}

