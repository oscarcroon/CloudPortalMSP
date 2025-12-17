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
 * Get the admin provisioner key from environment.
 * This is server-only and never stored in database.
 */
const getProvisionerKey = (instanceId?: string | null): string => {
  // Support multiple instances via WINDOWSDNS_PROVISIONER_KEY_<INSTANCE>
  if (instanceId) {
    const instanceKey = process.env[`WINDOWSDNS_PROVISIONER_KEY_${instanceId.toUpperCase()}`]
    if (instanceKey) return instanceKey
  }
  // Fall back to default
  const defaultKey = process.env.WINDOWSDNS_PROVISIONER_KEY
  if (!defaultKey) {
    throw createError({
      statusCode: 500,
      message: 'Windows DNS provisioner key not configured'
    })
  }
  return defaultKey
}

/**
 * Make an admin request using the provisioner key.
 * Used for: ensure account, mint tokens
 */
export const adminRequest = async <T>(
  config: WindowsDnsOrgConfig,
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<T> => {
  const provisionerKey = getProvisionerKey(config.instanceId)
  const url = `${config.baseUrl}/api/v1/admin${path}`

  try {
    const res = await ofetch<WindowsDnsApiResponse<T>>(url, {
      method: options?.method ?? 'GET',
      body: options?.body,
      headers: {
        'x-admin-key': provisionerKey,
        'Content-Type': 'application/json'
      }
    })

    if (!res?.success) {
      const message = res?.errors?.[0]?.message ?? 'Windows DNS admin API error'
      throw createError({ statusCode: 502, message: `[windows-dns] ${message}` })
    }

    return res.result as T
  } catch (error: any) {
    const statusCode = error?.response?.status ?? error?.statusCode ?? 502
    const message =
      error?.data?.errors?.[0]?.message ||
      error?.data?.message ||
      error?.message ||
      'Windows DNS admin API error'

    throw createError({ statusCode, message: `[windows-dns] ${message}` })
  }
}

/**
 * Make a token-authenticated request to the public API.
 */
export const tokenRequest = async <T>(
  config: WindowsDnsOrgConfig,
  token: string,
  path: string,
  options?: { method?: string; body?: unknown; query?: Record<string, string> }
): Promise<T> => {
  const url = `${config.baseUrl}/api/v1${path}`

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
 */
export const ensureAccount = async (
  config: WindowsDnsOrgConfig,
  orgId: string,
  orgName: string,
  coreId: string
): Promise<{ accountId: string; created: boolean }> => {
  const result = await adminRequest<{ account: { id: string }; created: boolean }>(
    config,
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
 * Mint a new token via admin API.
 */
const mintToken = async (
  config: WindowsDnsOrgConfig,
  accountId: string,
  scopes: WindowsDnsTokenScope[],
  allowedZoneIds: string[] | '*',
  purpose?: string
): Promise<{ token: string; expiresAt: number }> => {
  const result = await adminRequest<{ token: string; tokenInfo: { expiresAt?: number } }>(
    config,
    `/accounts/${accountId}/tokens`,
    {
      method: 'POST',
      body: {
        name: `portal-token-${Date.now()}`,
        scopes,
        allowedZoneIds: allowedZoneIds === '*' ? '*' : allowedZoneIds,
        expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
        purpose: purpose ?? 'portal:windows-dns'
      }
    }
  )

  // Calculate expiry from TTL if not provided
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
    return tokenRequest<WindowsDnsZoneSummary[]>(this.config, token, '/zones')
  }

  /**
   * Run autodiscover to find matching zones.
   */
  async autodiscoverZones(): Promise<WindowsDnsZoneSummary[]> {
    const token = await getToken(this.config, this.orgId, ['autodiscover.read'])
    return tokenRequest<WindowsDnsZoneSummary[]>(this.config, token, '/autodiscover/zones')
  }

  /**
   * List records for a zone.
   */
  async listRecords(zoneId: string): Promise<WindowsDnsRecord[]> {
    const token = await getToken(this.config, this.orgId, ['records.read'])
    return tokenRequest<WindowsDnsRecord[]>(this.config, token, `/zones/${zoneId}/dns_records`)
  }

  /**
   * Create a record in a zone.
   */
  async createRecord(zoneId: string, record: Partial<WindowsDnsRecord>): Promise<WindowsDnsRecord> {
    const token = await getToken(this.config, this.orgId, ['records.write'])
    return tokenRequest<WindowsDnsRecord>(this.config, token, `/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: record
    })
  }

  /**
   * Create a new zone.
   */
  async createZone(zoneName: string, zoneType: string, serverId: string): Promise<WindowsDnsZoneSummary> {
    const token = await getToken(this.config, this.orgId, ['zones.create'])
    return tokenRequest<WindowsDnsZoneSummary>(this.config, token, '/zones', {
      method: 'POST',
      body: { zoneName, zoneType, serverId }
    })
  }
}

/**
 * Get a configured client for an org.
 */
export const getClientForOrg = async (orgId: string): Promise<WindowsDnsClient> => {
  const config = await getOrgConfig(orgId)
  if (!config?.baseUrl) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS is not configured for this organization'
    })
  }
  return new WindowsDnsClient(orgId, config)
}

