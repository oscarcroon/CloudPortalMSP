import { createError } from 'h3'
import { ofetch } from 'ofetch'
import type {
  WindowsDnsApiResponse,
  WindowsDnsOrgConfig,
  WindowsDnsTokenScope,
  WindowsDnsZoneSummary,
  WindowsDnsRecord,
  WindowsDnsZoneSelector,
  WindowsDnsSystemMintTokenResponse
} from './types'
import { getOrgConfig, saveOrgConfig, getAllowedZoneIds } from './org-config'
import { getOrMintToken, generateCacheKey, invalidateToken, invalidateOrgTokens } from './token-cache'

// Drift token configuration
// These values are sent to the backend which handles mint-or-return-existing logic
const DRIFT_TOKEN_TTL_HOURS = 1          // 1 hour TTL per request
const DRIFT_TOKEN_RENEW_WINDOW_MINUTES = 15  // Renew if within 15 min of expiry
const DRIFT_TOKEN_MAX_AGE_HOURS = 168    // Force fresh mint after 7 days (was 24h)

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

  console.log(`[windows-dns] systemRequest: ${options?.method ?? 'GET'} ${url}`)

  try {
    const res = await ofetch<WindowsDnsApiResponse<T>>(url, {
      method: options?.method ?? 'GET',
      body: options?.body,
      headers: {
        Authorization: `Bearer ${layerToken}`,
        'Content-Type': 'application/json'
      }
    })

    console.log(`[windows-dns] systemRequest response: success=${res?.success}`)

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

    console.log(`[windows-dns] systemRequest error: ${statusCode} ${message}`)
    throw createError({ statusCode, message: `[windows-dns] ${message}` })
  }
}

/**
 * Check if an error indicates token expiry.
 */
const isTokenExpiredError = (error: any): boolean => {
  const message =
    error?.data?.errors?.[0]?.message ||
    error?.data?.message ||
    error?.message ||
    ''
  return (
    message.includes('Token expired') ||
    message.includes('token expired') ||
    error?.response?.status === 401
  )
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
 * Make a token-authenticated request with automatic retry on token expiry.
 * 
 * If the token has expired:
 * 1. Invalidates the cached token for the org
 * 2. Gets a fresh token via the provided getTokenFn
 * 3. Retries the request once
 * 
 * This handles the edge case where the client-side cache is valid but
 * the backend has rotated/expired the token (e.g., past maxAge).
 */
export const tokenRequestWithRetry = async <T>(
  orgId: string,
  instanceId: string | null | undefined,
  getTokenFn: () => Promise<string>,
  path: string,
  options?: { method?: string; body?: unknown; query?: Record<string, string> }
): Promise<T> => {
  const token = await getTokenFn()
  console.log(`[windows-dns] Initial token for ${path}: ${token.slice(0, 20)}...`)

  try {
    return await tokenRequest<T>(instanceId, token, path, options)
  } catch (error: any) {
    // Check if this is a token expiry error
    if (isTokenExpiredError(error)) {
      const errorMsg = error?.data?.errors?.[0]?.message || error?.data?.message || error?.message || 'unknown'
      console.log(`[windows-dns] Token error for org ${orgId}: "${errorMsg}", invalidating cache and retrying...`)

      // Invalidate all cached tokens for this org
      invalidateOrgTokens(orgId)

      // Get a fresh token (will mint a new one since cache is invalidated)
      const freshToken = await getTokenFn()
      console.log(`[windows-dns] Fresh token for ${path}: ${freshToken.slice(0, 20)}... (same as before: ${token === freshToken})`)

      // Retry the request with the fresh token
      try {
        return await tokenRequest<T>(instanceId, freshToken, path, options)
      } catch (retryError: any) {
        const retryMsg = retryError?.data?.errors?.[0]?.message || retryError?.data?.message || retryError?.message || 'unknown'
        console.log(`[windows-dns] Retry also failed: "${retryMsg}"`)
        throw retryError
      }
    }

    // Re-throw other errors
    throw error
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
 * Format account name for display.
 * Includes both the org name and coreId for easy identification.
 * 
 * Examples:
 * - "Acme Corp (ABCD)" - when org name is available
 * - "ABCD" - when only coreId is available (fallback)
 */
const formatAccountName = (orgName: string | undefined | null, coreId: string): string => {
  const normalizedCoreId = coreId.toUpperCase()

  // If orgName is missing or just the fallback format "Org <id>", use coreId only
  if (!orgName || orgName.startsWith('Org ') || orgName === normalizedCoreId) {
    return normalizedCoreId
  }

  // Include both org name and coreId for identification
  return `${orgName} (${normalizedCoreId})`
}

/**
 * Ensure a Windows DNS account exists for the org.
 * Creates one if it doesn't exist, using the org's COREID as externalRef.
 * Uses system-token (LayerToken) for bootstrap.
 * 
 * externalRef format: `coreid:<coreid>` (new format)
 * 
 * @param config - Org configuration
 * @param orgId - Organization ID
 * @param orgName - Organization name (optional, will use coreId if not provided)
 * @param coreId - The organization's COREID
 */
export const ensureAccount = async (
  config: WindowsDnsOrgConfig,
  orgId: string,
  orgName: string | undefined | null,
  coreId: string
): Promise<{ accountId: string; created: boolean }> => {
  // Use prefixed format for externalRef
  const externalRef = formatCoreIdExternalRef(coreId)
  // Format a readable account name
  const accountName = formatAccountName(orgName, coreId)

  try {
    const result = await systemRequest<{ account: { id: string }; created: boolean }>(
      config.instanceId,
      '/accounts/ensure',
      {
        method: 'POST',
        body: {
          name: accountName,
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
      message: `Failed to ensure Windows DNS account "${accountName}" (coreId: ${coreId}): ${errorMessage}`
    })
  }
}

/**
 * Mint or retrieve a drift token via system API.
 * 
 * Uses the new mint-or-return-existing pattern:
 * - Backend computes a fingerprint based on scopes + zoneSelector
 * - If an active token with same fingerprint exists, it returns that token (with sliding TTL)
 * - Otherwise, a new deterministic token is minted
 * 
 * This eliminates token spam and ensures efficient token reuse.
 * 
 * @param config - Org configuration with instanceId
 * @param accountId - The WindowsDNS account ID
 * @param scopes - Required token scopes
 * @param zoneSelector - 'account_set' (recommended) or 'explicit'
 * @param allowedZoneIds - Only used when zoneSelector is 'explicit'
 */
const mintToken = async (
  config: WindowsDnsOrgConfig,
  accountId: string,
  scopes: WindowsDnsTokenScope[],
  zoneSelector: WindowsDnsZoneSelector = 'account_set',
  allowedZoneIds: string[] | '*' = '*'
): Promise<{ token: string; expiresAt: number; renewed: boolean }> => {
  console.log(`[windows-dns] mintToken called for account ${accountId}, scopes=${scopes.join(',')}, zoneSelector=${zoneSelector}`)

  try {
    const result = await systemRequest<WindowsDnsSystemMintTokenResponse>(
      config.instanceId,
      `/accounts/${accountId}/tokens`,
      {
        method: 'POST',
        body: {
          name: `drift-token-portal`, // Consistent name for drift tokens
          scopes,
          // Only send allowedZoneIds for explicit selector
          allowedZoneIds: zoneSelector === 'explicit' && allowedZoneIds !== '*'
            ? allowedZoneIds
            : undefined,
          // Drift token configuration
          purpose: 'drift',
          zoneSelector,
          ttlHours: DRIFT_TOKEN_TTL_HOURS,
          renewWindowMinutes: DRIFT_TOKEN_RENEW_WINDOW_MINUTES,
          maxAgeHours: DRIFT_TOKEN_MAX_AGE_HOURS
        }
      }
    )

    console.log(`[windows-dns] mintToken response: token=${result?.token?.slice(0, 20)}..., renewed=${result?.renewed}, expiresAt=${result?.tokenInfo?.expiresAt}`)

    if (!result?.token) {
      throw createError({
        statusCode: 502,
        message: 'Windows DNS token minting returned invalid response: missing token'
      })
    }

    // Calculate expiry from response
    const expiresAt = result.tokenInfo?.expiresAt
      ? result.tokenInfo.expiresAt * 1000 // Convert to ms if seconds
      : Date.now() + DRIFT_TOKEN_TTL_HOURS * 3600 * 1000

    console.log(`[windows-dns] mintToken computed expiresAt: ${new Date(expiresAt).toISOString()}`)

    return {
      token: result.token,
      expiresAt,
      renewed: result.renewed ?? false
    }
  } catch (error: any) {
    console.log(`[windows-dns] mintToken error: ${error?.message}`)
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
 * Uses the new drift token pattern:
 * - For most operations, uses zoneSelector: 'account_set' which lets the backend
 *   dynamically determine allowed zones based on account ownership and COREID matches
 * - For specific zone access, uses zoneSelector: 'explicit' with the specific zone IDs
 * 
 * The backend handles mint-or-return-existing logic, so we always call it but
 * get efficient token reuse via fingerprinting.
 */
export const getToken = async (
  config: WindowsDnsOrgConfig,
  orgId: string,
  scopes: WindowsDnsTokenScope[],
  allowedZoneIds: string[] | '*' = '*',
  useAccountSet: boolean = true  // Use account_set by default for dynamic access
): Promise<string> => {
  if (!config.windowsDnsAccountId) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS account not configured for this organization'
    })
  }

  // Determine zone selector strategy
  // - Use 'account_set' for general operations (dynamic based on ownership/COREID)
  // - Use 'explicit' only when specific zone IDs are required
  const zoneSelector: WindowsDnsZoneSelector = (useAccountSet && allowedZoneIds === '*')
    ? 'account_set'
    : 'explicit'

  // For explicit selector, we need actual zone IDs
  let effectiveAllowedZoneIds = allowedZoneIds
  if (zoneSelector === 'explicit' && allowedZoneIds === '*') {
    // Fetch allowlist from database for explicit access
    const dbAllowedZoneIds = await getAllowedZoneIds(orgId)
    if (dbAllowedZoneIds.length === 0) {
      throw createError({
        statusCode: 403,
        message: 'No zones are activated for this organization. Please run autodiscover and activate zones first.'
      })
    }
    effectiveAllowedZoneIds = dbAllowedZoneIds
  }

  // Generate cache key based on the request
  const cacheKey = generateCacheKey({
    orgId,
    accountId: config.windowsDnsAccountId,
    scopes,
    allowedZoneIds: zoneSelector === 'account_set' ? '*' : effectiveAllowedZoneIds
  })

  // Use singleflight cache - backend also does mint-or-return-existing
  // so even if cache misses, we get efficient token reuse
  const cached = await getOrMintToken(cacheKey, async () => {
    const { token, expiresAt, renewed } = await mintToken(
      config,
      config.windowsDnsAccountId!,
      scopes,
      zoneSelector,
      effectiveAllowedZoneIds
    )

    if (renewed) {
      console.log(`[windows-dns] Token renewed for account ${config.windowsDnsAccountId}, scopes: ${scopes.join(',')}`)
    }

    return {
      token,
      expiresAt,
      scopes,
      allowedZoneIds: zoneSelector === 'account_set' ? '*' : effectiveAllowedZoneIds
    }
  })

  return cached.token
}

/**
 * Get a token with specific zone IDs (explicit access).
 * Use this when you need to access specific zones that may not be covered by account_set.
 * 
 * Note: For most use cases, the default getToken with account_set is preferred
 * as it provides dynamic access based on ownership/COREID matches.
 */
export const getTokenForZones = async (
  config: WindowsDnsOrgConfig,
  orgId: string,
  scopes: WindowsDnsTokenScope[],
  zoneIds: string[]
): Promise<string> => {
  if (zoneIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one zone ID is required'
    })
  }

  // Force explicit selector with specific zone IDs
  return getToken(config, orgId, scopes, zoneIds, false)
}

/**
 * High-level client that combines org config lookup, token management, and API calls.
 * Uses drift tokens (wdns_drift_*) with the new mint-or-return-existing pattern.
 * 
 * Token behavior:
 * - Default: Uses zoneSelector: 'account_set' which dynamically grants access
 *   to zones based on account ownership and COREID matches
 * - Explicit: Uses zoneSelector: 'explicit' when specific zone IDs are required
 * 
 * Benefits of drift tokens:
 * - No token spam: Same fingerprint = same token returned
 * - Sliding TTL: Tokens auto-renew when accessed near expiry
 * - Max age: Tokens forced to refresh after 24 hours for security
 */
export class WindowsDnsClient {
  constructor(
    private orgId: string,
    private config: WindowsDnsOrgConfig
  ) { }

  /**
   * List zones for the authenticated account.
   * 
   * Portal is source of truth for zone ownership:
   * - Pass allowedZoneIds to filter which zones are returned
   * - Pass '*' for admin/bootstrap operations to see all zones
   */
  async listZones(allowedZoneIds: string[] | '*' = '*'): Promise<WindowsDnsZoneSummary[]> {
    return tokenRequestWithRetry<WindowsDnsZoneSummary[]>(
      this.orgId,
      this.config.instanceId,
      () => getToken(this.config, this.orgId, ['zones.read'], allowedZoneIds),
      '/zones'
    )
  }

  /**
   * Run autodiscover to find matching zones.
   * Uses autodiscover.read scope (not zone-scoped).
   */
  async autodiscoverZones(): Promise<WindowsDnsZoneSummary[]> {
    // autodiscover.read is self-filtered by coreId, no zone restriction needed
    return tokenRequestWithRetry<WindowsDnsZoneSummary[]>(
      this.orgId,
      this.config.instanceId,
      () => getToken(this.config, this.orgId, ['autodiscover.read'], '*'),
      '/autodiscover/zones'
    )
  }

  /**
   * List records for a zone.
   * Uses records.read scope (zone-scoped, uses allowlist).
   */
  async listRecords(zoneId: string): Promise<WindowsDnsRecord[]> {
    // records.read is zone-scoped, will automatically use allowlist from DB
    return tokenRequestWithRetry<WindowsDnsRecord[]>(
      this.orgId,
      this.config.instanceId,
      () => getToken(this.config, this.orgId, ['records.read']),
      `/zones/${zoneId}/dns_records`
    )
  }

  /**
   * Export zone as BIND-format text file.
   * Uses records.read scope (zone-scoped).
   * Returns the raw text content of the zone file.
   */
  async exportZone(zoneId: string): Promise<string> {
    const token = await getToken(this.config, this.orgId, ['records.read'])
    const baseUrl = getLayerBaseUrl(this.config.instanceId)
    const url = `${baseUrl}/zones/${zoneId}/export`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/plain'
      }
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw createError({
        statusCode: response.status,
        message: `[windows-dns] Export failed: ${errorText}`
      })
    }

    return await response.text()
  }

  /**
   * List records for a specific zone with explicit zone access.
   * Use this when you need to access a zone that may not be in the allowlist.
   */
  async listRecordsForZone(zoneId: string): Promise<WindowsDnsRecord[]> {
    return tokenRequestWithRetry<WindowsDnsRecord[]>(
      this.orgId,
      this.config.instanceId,
      () => getTokenForZones(this.config, this.orgId, ['records.read'], [zoneId]),
      `/zones/${zoneId}/dns_records`
    )
  }

  /**
   * Create a record in a zone.
   * Uses records.write scope (zone-scoped, uses allowlist).
   */
  async createRecord(zoneId: string, record: Partial<WindowsDnsRecord>): Promise<WindowsDnsRecord> {
    // records.write is zone-scoped, will automatically use allowlist from DB
    return tokenRequestWithRetry<WindowsDnsRecord>(
      this.orgId,
      this.config.instanceId,
      () => getToken(this.config, this.orgId, ['records.write']),
      `/zones/${zoneId}/dns_records`,
      { method: 'POST', body: record }
    )
  }

  /**
   * Create a record in a specific zone with explicit zone access.
   * Use this when you need to access a zone that may not be in the allowlist.
   */
  async createRecordInZone(zoneId: string, record: Partial<WindowsDnsRecord>): Promise<WindowsDnsRecord> {
    return tokenRequestWithRetry<WindowsDnsRecord>(
      this.orgId,
      this.config.instanceId,
      () => getTokenForZones(this.config, this.orgId, ['records.write'], [zoneId]),
      `/zones/${zoneId}/dns_records`,
      { method: 'POST', body: record }
    )
  }

  /**
   * Delete a record in a zone.
   * Uses records.write scope (zone-scoped, uses allowlist).
   */
  async deleteRecord(zoneId: string, record: { name: string; type: string; content?: string }): Promise<void> {
    await tokenRequestWithRetry<void>(
      this.orgId,
      this.config.instanceId,
      () => getTokenForZones(this.config, this.orgId, ['records.write'], [zoneId]),
      `/zones/${zoneId}/dns_records/delete`,
      { method: 'POST', body: record }
    )
  }

  /**
   * Update a record in a zone.
   * Uses records.write scope (zone-scoped).
   * Note: If name/type/content changes, backend will return new recordId.
   */
  async updateRecord(zoneId: string, recordId: string, updates: Partial<WindowsDnsRecord>): Promise<WindowsDnsRecord> {
    return tokenRequestWithRetry<WindowsDnsRecord>(
      this.orgId,
      this.config.instanceId,
      () => getTokenForZones(this.config, this.orgId, ['records.write'], [zoneId]),
      `/zones/${zoneId}/dns_records/${recordId}`,
      { method: 'PATCH', body: updates }
    )
  }

  /**
   * Create a new zone.
   * Uses zones.create scope (not zone-scoped for creation).
   */
  async createZone(zoneName: string, zoneType: string, serverId: string): Promise<WindowsDnsZoneSummary> {
    // zones.create is not zone-scoped (we're creating a new zone)
    return tokenRequestWithRetry<WindowsDnsZoneSummary>(
      this.orgId,
      this.config.instanceId,
      () => getToken(this.config, this.orgId, ['zones.create'], '*'),
      '/zones',
      { method: 'POST', body: { zoneName, zoneType, serverId } }
    )
  }

  /**
   * Update a zone.
   * Uses zones.write scope (zone-scoped, uses allowlist).
   */
  async updateZone(zoneId: string, updates: Partial<{ zoneName: string }>): Promise<WindowsDnsZoneSummary> {
    // zones.write is zone-scoped, will automatically use allowlist from DB
    return tokenRequestWithRetry<WindowsDnsZoneSummary>(
      this.orgId,
      this.config.instanceId,
      () => getToken(this.config, this.orgId, ['zones.write']),
      `/zones/${zoneId}`,
      { method: 'PATCH', body: updates }
    )
  }

  /**
   * Delete a zone.
   * Uses zones.write scope (zone-scoped).
   * This removes the zone from Windows DNS server and database.
   */
  async deleteZone(zoneId: string): Promise<{ deleted: boolean; id: string; zoneName: string }> {
    return tokenRequestWithRetry<{ deleted: boolean; id: string; zoneName: string }>(
      this.orgId,
      this.config.instanceId,
      () => getTokenForZones(this.config, this.orgId, ['zones.write'], [zoneId]),
      `/zones/${zoneId}`,
      { method: 'DELETE' }
    )
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

