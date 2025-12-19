import { createError } from 'h3'
import { ofetch } from 'ofetch'
import type {
  WindowsDnsApiResponse,
  WindowsDnsOrgConfig,
  WindowsDnsTokenScope,
  WindowsDnsZoneSummary,
  WindowsDnsRecord
} from './types'
import { getOrgConfig, saveOrgConfig } from './org-config'
import { getOrMintToken, generateCacheKey } from './token-cache'

const TOKEN_TTL_SECONDS = 300 // 5 minutes

/**
 * Get the global Layer API configuration from environment.
 */
const getLayerConfig = () => {
  const baseUrl = process.env.WINDOWS_DNS_API_URL
  const layerToken = process.env.WINDOWS_DNS_LAYER_TOKEN

  if (!baseUrl) {
    throw createError({
      statusCode: 500,
      message: 'WINDOWS_DNS_API_URL not configured'
    })
  }

  if (!layerToken) {
    throw createError({
      statusCode: 500,
      message: 'WINDOWS_DNS_LAYER_TOKEN not configured'
    })
  }

  return { baseUrl, layerToken }
}

/**
 * Get the LayerToken (system token) for bootstrap operations.
 * This is server-only and never stored in database.
 */
const getLayerToken = (instanceId?: string | null): string => {
  // Support multiple instances via WINDOWS_DNS_LAYER_TOKEN_<INSTANCE>
  if (instanceId) {
    const instanceToken = process.env[`WINDOWS_DNS_LAYER_TOKEN_${instanceId.toUpperCase()}`]
    if (instanceToken) return instanceToken
  }
  // Fall back to default
  const defaultToken = process.env.WINDOWS_DNS_LAYER_TOKEN
  if (!defaultToken) {
    throw createError({
      statusCode: 500,
      message: 'Windows DNS LayerToken not configured'
    })
  }
  return defaultToken
}

/**
 * Get the Layer API base URL.
 */
const getLayerBaseUrl = (instanceId?: string | null): string => {
  // Support multiple instances via WINDOWS_DNS_API_URL_<INSTANCE>
  if (instanceId) {
    const instanceUrl = process.env[`WINDOWS_DNS_API_URL_${instanceId.toUpperCase()}`]
    if (instanceUrl) return instanceUrl
  }
  // Fall back to default
  const defaultUrl = process.env.WINDOWS_DNS_API_URL
  if (!defaultUrl) {
    throw createError({
      statusCode: 500,
      message: 'WINDOWS_DNS_API_URL not configured'
    })
  }
  return defaultUrl
}

/**
 * Make a system request using the LayerToken (system token).
 * Used for: ensure account, mint tokens (bootstrap operations only)
 */
export const systemRequest = async <T>(
  instanceId: string | null | undefined,
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<T> => {
  const baseUrl = getLayerBaseUrl(instanceId)
  const layerToken = getLayerToken(instanceId)
  const url = `${baseUrl}/system${path}`

  try {
    const res = await ofetch<WindowsDnsApiResponse<T>>(url, {
      method: options?.method ?? 'GET',
      body: options?.body,
      headers: {
        Authorization: `Bearer ${layerToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!res?.success) {
      const message = res?.errors?.[0]?.message ?? 'Windows DNS system API error'
      throw createError({ statusCode: 502, message: `[windows-dns] ${message}` })
    }

    return res.result as T
  } catch (error: any) {
    const statusCode = error?.response?.status ?? error?.statusCode ?? 502
    const message =
      error?.data?.errors?.[0]?.message ||
      error?.data?.message ||
      error?.message ||
      'Windows DNS system API error'

    throw createError({ statusCode, message: `[windows-dns] ${message}` })
  }
}

/**
 * Make a token-authenticated request to the public API.
 * Uses per-account tokens (wdns_tok_*) for drift operations.
 */
export const tokenRequest = async <T>(
  instanceId: string | null | undefined,
  token: string,
  path: string,
  options?: { method?: string; body?: unknown; query?: Record<string, string> }
): Promise<T> => {
  const baseUrl = getLayerBaseUrl(instanceId)
  const url = `${baseUrl}${path}`

  try {
    const res = await ofetch<WindowsDnsApiResponse<T>>(url, {
      method: options?.method ?? 'GET',
      body: options?.body,
      query: options?.query,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!res?.success) {
      const message = res?.errors?.[0]?.message ?? 'Windows DNS API error'
      throw createError({ statusCode: 502, message: `[windows-dns] ${message}` })
    }

    return res.result as T
  } catch (error: any) {
    const statusCode = error?.response?.status ?? error?.statusCode ?? 502
    const message =
      error?.data?.errors?.[0]?.message ||
      error?.data?.message ||
      error?.message ||
      'Windows DNS API error'

    throw createError({ statusCode, message: `[windows-dns] ${message}` })
  }
}

/**
 * Ensure a Windows DNS account exists for the org.
 * Creates one if it doesn't exist, using the org's COREID as externalRef.
 * Uses system-token (LayerToken) for bootstrap.
 */
export const ensureAccount = async (
  config: WindowsDnsOrgConfig,
  orgId: string,
  orgName: string,
  coreId: string
): Promise<{ accountId: string; created: boolean }> => {
  const result = await systemRequest<{ account: { id: string }; created: boolean }>(
    config.instanceId,
    '/accounts/ensure',
    {
      method: 'POST',
      body: {
        name: orgName,
        externalRef: coreId
      }
    }
  )

  // Update org config with the account ID
  await saveOrgConfig(orgId, {
    windowsDnsAccountId: result.account.id,
    coreId
  })

  return {
    accountId: result.account.id,
    created: result.created
  }
}

/**
 * Mint a new per-account token via system API.
 * Uses system-token (LayerToken) to mint per-account tokens for drift operations.
 */
const mintToken = async (
  config: WindowsDnsOrgConfig,
  accountId: string,
  scopes: WindowsDnsTokenScope[],
  allowedZoneIds: string[] | '*',
  purpose?: string
): Promise<{ token: string; expiresAt: number }> => {
  // Calculate expiry time (now + TTL)
  const expiresAtDate = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000)

  const result = await systemRequest<{ token: string; tokenInfo: { expiresAt?: number } }>(
    config.instanceId,
    `/accounts/${accountId}/tokens`,
    {
      method: 'POST',
      body: {
        name: `portal-token-${Date.now()}`,
        scopes,
        allowedZoneIds: allowedZoneIds === '*' ? undefined : allowedZoneIds,
        expiresAt: expiresAtDate.toISOString()
      }
    }
  )

  // Calculate expiry from response or TTL
  const expiresAt = result.tokenInfo?.expiresAt
    ? result.tokenInfo.expiresAt * 1000 // Convert to ms
    : Date.now() + TOKEN_TTL_SECONDS * 1000

  return {
    token: result.token,
    expiresAt
  }
}

/**
 * Get a valid token for making requests, using cache with singleflight.
 */
export const getToken = async (
  config: WindowsDnsOrgConfig,
  orgId: string,
  scopes: WindowsDnsTokenScope[],
  allowedZoneIds: string[] | '*' = '*',
  purpose?: string
): Promise<string> => {
  if (!config.windowsDnsAccountId) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS account not configured for this organization'
    })
  }

  const cacheKey = generateCacheKey({
    orgId,
    accountId: config.windowsDnsAccountId,
    scopes,
    allowedZoneIds
  })

  const cached = await getOrMintToken(cacheKey, async () => {
    const { token, expiresAt } = await mintToken(
      config,
      config.windowsDnsAccountId!,
      scopes,
      allowedZoneIds,
      purpose
    )
    return {
      token,
      expiresAt,
      scopes,
      allowedZoneIds
    }
  })

  return cached.token
}

/**
 * High-level client that combines org config lookup, token management, and API calls.
 * Uses per-account tokens (wdns_tok_*) for drift operations.
 */
export class WindowsDnsClient {
  constructor(
    private orgId: string,
    private config: WindowsDnsOrgConfig
  ) {}

  /**
   * List zones for the authenticated account.
   */
  async listZones(scopes: WindowsDnsTokenScope[]): Promise<WindowsDnsZoneSummary[]> {
    const token = await getToken(this.config, this.orgId, scopes)
    return tokenRequest<WindowsDnsZoneSummary[]>(this.config.instanceId, token, '/zones')
  }

  /**
   * Run autodiscover to find matching zones.
   */
  async autodiscoverZones(): Promise<WindowsDnsZoneSummary[]> {
    const token = await getToken(this.config, this.orgId, ['autodiscover.read'])
    return tokenRequest<WindowsDnsZoneSummary[]>(this.config.instanceId, token, '/autodiscover/zones')
  }

  /**
   * List records for a zone.
   */
  async listRecords(zoneId: string): Promise<WindowsDnsRecord[]> {
    const token = await getToken(this.config, this.orgId, ['records.read'])
    return tokenRequest<WindowsDnsRecord[]>(this.config.instanceId, token, `/zones/${zoneId}/dns_records`)
  }

  /**
   * Create a record in a zone.
   */
  async createRecord(zoneId: string, record: Partial<WindowsDnsRecord>): Promise<WindowsDnsRecord> {
    const token = await getToken(this.config, this.orgId, ['records.write'])
    return tokenRequest<WindowsDnsRecord>(this.config.instanceId, token, `/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: record
    })
  }

  /**
   * Create a new zone.
   */
  async createZone(zoneName: string, zoneType: string, serverId: string): Promise<WindowsDnsZoneSummary> {
    const token = await getToken(this.config, this.orgId, ['zones.create'])
    return tokenRequest<WindowsDnsZoneSummary>(this.config.instanceId, token, '/zones', {
      method: 'POST',
      body: { zoneName, zoneType, serverId }
    })
  }
}

/**
 * Get a configured client for an org.
 * Note: baseUrl is now global via WINDOWS_DNS_API_URL, org config just stores accountId/instanceId.
 */
export const getClientForOrg = async (orgId: string): Promise<WindowsDnsClient> => {
  const config = await getOrgConfig(orgId)
  if (!config?.windowsDnsAccountId) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS account not configured for this organization. Run setup first.'
    })
  }
  return new WindowsDnsClient(orgId, config)
}

