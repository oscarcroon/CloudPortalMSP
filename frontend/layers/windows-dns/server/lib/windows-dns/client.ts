import { createError } from 'h3'
import { ofetch } from 'ofetch'
import type {
  WindowsDnsApiResponse,
  WindowsDnsOrgConfig,
  WindowsDnsTokenScope,
  WindowsDnsZoneSummary,
  WindowsDnsRecord
} from './types'
import { getOrgConfig, saveOrgConfig, getAllowedZoneIds } from './org-config'
import { getOrMintToken, generateCacheKey } from './token-cache'

const TOKEN_TTL_SECONDS = 600 // 10 minutes (must be > 5 min minimum enforced by layer)

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
 * Format CoreID for externalRef (prefixed format for clarity and future-proofing).
 * Format: `coreid:<coreid>`
 * 
 * Handles already-prefixed input to prevent double-prefixing.
 */
export const formatCoreIdExternalRef = (coreId: string): string => {
  // If already prefixed, extract the raw coreId first to prevent double-prefixing
  if (coreId.startsWith('coreid:')) {
    coreId = coreId.slice(7)
  }
  return `coreid:${coreId.toUpperCase()}`
}

/**
 * Parse CoreID from externalRef (handles both prefixed and legacy formats).
 * Returns the raw coreId (uppercased) or null if not a valid coreId ref.
 */
export const parseCoreIdFromExternalRef = (externalRef: string | null | undefined): string | null => {
  if (!externalRef) return null
  // Prefixed format: coreid:<id>
  if (externalRef.startsWith('coreid:')) {
    return externalRef.slice(7).toUpperCase()
  }
  // Legacy format: raw 4-char coreId (backwards compatibility)
  if (/^[A-Z0-9]{4}$/i.test(externalRef)) {
    return externalRef.toUpperCase()
  }
  return null
}

/**
 * Ensure a Windows DNS account exists for the org.
 * Creates one if it doesn't exist, using the org's COREID as externalRef.
 * Uses system-token (LayerToken) for bootstrap.
 * 
 * externalRef format: `coreid:<coreid>` (new format)
 */
export const ensureAccount = async (
  config: WindowsDnsOrgConfig,
  orgId: string,
  orgName: string,
  coreId: string
): Promise<{ accountId: string; created: boolean }> => {
  // Use prefixed format for externalRef
  const externalRef = formatCoreIdExternalRef(coreId)

  try {
    const result = await systemRequest<{ account: { id: string }; created: boolean }>(
      config.instanceId,
      '/accounts/ensure',
      {
        method: 'POST',
        body: {
          name: orgName,
          externalRef
        }
      }
    )

    if (!result?.account?.id) {
      throw createError({
        statusCode: 502,
        message: 'Windows DNS ensure account returned invalid response: missing account.id'
      })
    }

    // Update org config with the account ID (coreId is derived from organizations, not stored here)
    await saveOrgConfig(orgId, {
      windowsDnsAccountId: result.account.id
    })

    return {
      accountId: result.account.id,
      created: result.created ?? false
    }
  } catch (error: any) {
    // Improve error message for debugging
    const errorMessage = error?.message || 'Unknown error'
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: `Failed to ensure Windows DNS account for org ${orgId} (coreId: ${coreId}, externalRef: ${externalRef}): ${errorMessage}`
    })
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

  try {
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

    if (!result?.token) {
      throw createError({
        statusCode: 502,
        message: 'Windows DNS token minting returned invalid response: missing token'
      })
    }

    // Calculate expiry from response or TTL
    const expiresAt = result.tokenInfo?.expiresAt
      ? result.tokenInfo.expiresAt * 1000 // Convert to ms
      : Date.now() + TOKEN_TTL_SECONDS * 1000

    return {
      token: result.token,
      expiresAt
    }
  } catch (error: any) {
    // Improve error message for account not found
    if (error?.message?.includes('Account not found') || error?.statusCode === 404) {
      throw createError({
        statusCode: 404,
        message: `Windows DNS account ${accountId} not found. The account may not have been created successfully. Please try running autodiscover again.`
      })
    }
    throw error
  }
}

/**
 * Scopes that require zone-level access (must have allowedZoneIds).
 * These scopes can modify or access zone-specific data.
 */
const ZONE_SCOPED_SCOPES: WindowsDnsTokenScope[] = [
  'records.read',
  'records.write',
  'zones.write',
  'ownership.read',
  'ownership.write'
]

/**
 * Check if any of the requested scopes require zone-level access.
 */
export const requiresZoneScope = (scopes: WindowsDnsTokenScope[]): boolean => {
  return scopes.some(scope => ZONE_SCOPED_SCOPES.includes(scope))
}

/**
 * Get a valid token for making requests, using cache with singleflight.
 * 
 * For scopes that require zone-level access (records.*, zones.write, ownership.*),
 * the allowedZoneIds will be automatically fetched from the database if not provided.
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

  // For zone-scoped operations, enforce allowlist from database
  let effectiveAllowedZoneIds = allowedZoneIds

  if (requiresZoneScope(scopes) && allowedZoneIds === '*') {
    // Fetch allowlist from database
    const dbAllowedZoneIds = await getAllowedZoneIds(orgId)

    if (dbAllowedZoneIds.length === 0) {
      throw createError({
        statusCode: 403,
        message: 'No zones are activated for this organization. Please run autodiscover and activate zones first.'
      })
    }

    effectiveAllowedZoneIds = dbAllowedZoneIds
  }

  const cacheKey = generateCacheKey({
    orgId,
    accountId: config.windowsDnsAccountId,
    scopes,
    allowedZoneIds: effectiveAllowedZoneIds
  })

  const cached = await getOrMintToken(cacheKey, async () => {
    const { token, expiresAt } = await mintToken(
      config,
      config.windowsDnsAccountId!,
      scopes,
      effectiveAllowedZoneIds,
      purpose
    )
    return {
      token,
      expiresAt,
      scopes,
      allowedZoneIds: effectiveAllowedZoneIds
    }
  })

  return cached.token
}

/**
 * Get a token with specific zone IDs (override the automatic allowlist).
 * Use this when you need to access specific zones that may not be in the allowlist.
 */
export const getTokenForZones = async (
  config: WindowsDnsOrgConfig,
  orgId: string,
  scopes: WindowsDnsTokenScope[],
  zoneIds: string[],
  purpose?: string
): Promise<string> => {
  if (zoneIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one zone ID is required'
    })
  }

  return getToken(config, orgId, scopes, zoneIds, purpose)
}

/**
 * High-level client that combines org config lookup, token management, and API calls.
 * Uses per-account tokens (wdns_tok_*) for drift operations.
 * 
 * Token behavior:
 * - For zone-scoped operations (records.*, zones.write, ownership.*): 
 *   Uses allowlist from database automatically.
 * - For autodiscover.read, zones.read, zones.create: 
 *   Can use wildcard access.
 */
export class WindowsDnsClient {
  constructor(
    private orgId: string,
    private config: WindowsDnsOrgConfig
  ) {}

  /**
   * List zones for the authenticated account.
   * 
   * Portal is source of truth for zone ownership:
   * - Pass allowedZoneIds to filter which zones are returned
   * - Pass '*' for admin/bootstrap operations to see all zones
   */
  async listZones(allowedZoneIds: string[] | '*' = '*'): Promise<WindowsDnsZoneSummary[]> {
    const token = await getToken(this.config, this.orgId, ['zones.read'], allowedZoneIds)
    return tokenRequest<WindowsDnsZoneSummary[]>(this.config.instanceId, token, '/zones')
  }

  /**
   * Run autodiscover to find matching zones.
   * Uses autodiscover.read scope (not zone-scoped).
   */
  async autodiscoverZones(): Promise<WindowsDnsZoneSummary[]> {
    // autodiscover.read is self-filtered by coreId, no zone restriction needed
    const token = await getToken(this.config, this.orgId, ['autodiscover.read'], '*')
    return tokenRequest<WindowsDnsZoneSummary[]>(this.config.instanceId, token, '/autodiscover/zones')
  }

  /**
   * List records for a zone.
   * Uses records.read scope (zone-scoped, uses allowlist).
   */
  async listRecords(zoneId: string): Promise<WindowsDnsRecord[]> {
    // records.read is zone-scoped, will automatically use allowlist from DB
    const token = await getToken(this.config, this.orgId, ['records.read'])
    return tokenRequest<WindowsDnsRecord[]>(this.config.instanceId, token, `/zones/${zoneId}/dns_records`)
  }

  /**
   * List records for a specific zone with explicit zone access.
   * Use this when you need to access a zone that may not be in the allowlist.
   */
  async listRecordsForZone(zoneId: string): Promise<WindowsDnsRecord[]> {
    const token = await getTokenForZones(this.config, this.orgId, ['records.read'], [zoneId])
    return tokenRequest<WindowsDnsRecord[]>(this.config.instanceId, token, `/zones/${zoneId}/dns_records`)
  }

  /**
   * Create a record in a zone.
   * Uses records.write scope (zone-scoped, uses allowlist).
   */
  async createRecord(zoneId: string, record: Partial<WindowsDnsRecord>): Promise<WindowsDnsRecord> {
    // records.write is zone-scoped, will automatically use allowlist from DB
    const token = await getToken(this.config, this.orgId, ['records.write'])
    return tokenRequest<WindowsDnsRecord>(this.config.instanceId, token, `/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: record
    })
  }

  /**
   * Create a record in a specific zone with explicit zone access.
   * Use this when you need to access a zone that may not be in the allowlist.
   */
  async createRecordInZone(zoneId: string, record: Partial<WindowsDnsRecord>): Promise<WindowsDnsRecord> {
    const token = await getTokenForZones(this.config, this.orgId, ['records.write'], [zoneId])
    return tokenRequest<WindowsDnsRecord>(this.config.instanceId, token, `/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: record
    })
  }

  /**
   * Create a new zone.
   * Uses zones.create scope (not zone-scoped for creation).
   */
  async createZone(zoneName: string, zoneType: string, serverId: string): Promise<WindowsDnsZoneSummary> {
    // zones.create is not zone-scoped (we're creating a new zone)
    const token = await getToken(this.config, this.orgId, ['zones.create'], '*')
    return tokenRequest<WindowsDnsZoneSummary>(this.config.instanceId, token, '/zones', {
      method: 'POST',
      body: { zoneName, zoneType, serverId }
    })
  }

  /**
   * Update a zone.
   * Uses zones.write scope (zone-scoped, uses allowlist).
   */
  async updateZone(zoneId: string, updates: Partial<{ zoneName: string }>): Promise<WindowsDnsZoneSummary> {
    // zones.write is zone-scoped, will automatically use allowlist from DB
    const token = await getToken(this.config, this.orgId, ['zones.write'])
    return tokenRequest<WindowsDnsZoneSummary>(this.config.instanceId, token, `/zones/${zoneId}`, {
      method: 'PATCH',
      body: updates
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

