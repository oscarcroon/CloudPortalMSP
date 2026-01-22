/**
 * Windows DNS module types
 */

export type WindowsDnsModuleRole = 'viewer' | 'records-editor' | 'zone-admin' | 'module-admin'

export type WindowsDnsZoneRole = 'viewer' | 'records-only' | 'editor' | 'admin'

export interface WindowsDnsModuleRights {
  roles: WindowsDnsModuleRole[]
  canView: boolean
  canCreateZones: boolean
  canEditZones: boolean
  canEditRecords: boolean
  canManageOwnership: boolean
  canAutodiscover: boolean
  canManageOrgConfig: boolean
  // Redirect permissions
  canAccessRedirects: boolean
  canViewRedirects: boolean
  canCreateRedirects: boolean
  canEditRedirects: boolean
  canDeleteRedirects: boolean
  canImportRedirects: boolean
  canExportRedirects: boolean
  canViewRedirectConfig: boolean
  canEditRedirectConfig: boolean
  canViewTraefik: boolean
  canSyncTraefik: boolean
}

export interface WindowsDnsZoneAccess extends WindowsDnsModuleRights {
  zoneRole: WindowsDnsZoneRole | null
}

/**
 * Org config stored in CloudPortalMSP database (windows_dns_org_config table).
 * Note: LayerToken (WINDOWS_DNS_LAYER_TOKEN) is NOT stored here - it's a server-only env var.
 * Note: baseUrl is now global via WINDOWS_DNS_API_URL env var.
 * Note: coreId is DERIVED from organizations.core_id, not stored in config.
 */
export interface WindowsDnsOrgConfig {
  /** Optional instance identifier for multi-instance setups (maps to WINDOWS_DNS_API_URL_<INSTANCE>) */
  instanceId?: string | null
  /** The WindowsDNS accountId for this org (stored after ensure) */
  windowsDnsAccountId?: string | null
  /** COREID for this org - DERIVED from organizations.core_id (read-only) */
  coreId?: string | null
  /** When the module was enabled for this org */
  enabledAt?: Date | null
  /** Last time the connection was validated */
  lastValidatedAt?: Date | null
  /** Last sync timestamp */
  lastSyncAt?: Date | null
  /** Last sync status */
  lastSyncStatus?: string | null
  /** Last sync error message */
  lastSyncError?: string | null
}

/**
 * Enriched org config with organization data (used for display/operations)
 */
export interface WindowsDnsOrgConfigWithOrg extends WindowsDnsOrgConfig {
  organizationId: string
  organizationName?: string | null
}

/**
 * System API response types (used by LayerToken bootstrap operations)
 */
export interface WindowsDnsSystemAccountResponse {
  account: {
    id: string
    name: string
    externalRef?: string | null
    coreId?: string | null
  }
  created: boolean
}

/**
 * Token purpose: admin (UI-created) or drift (integration/automated)
 */
export type WindowsDnsTokenPurpose = 'admin' | 'drift'

/**
 * Zone selector type: explicit (listed zones) or account_set (dynamic based on account ownership/COREID)
 */
export type WindowsDnsZoneSelector = 'explicit' | 'account_set'

/**
 * Request payload for minting a drift token
 */
export interface WindowsDnsMintDriftTokenRequest {
  name: string
  scopes: WindowsDnsTokenScope[]
  allowedZoneIds?: string[] | '*'
  purpose: 'drift'
  zoneSelector: WindowsDnsZoneSelector
  ttlHours?: number        // Requested TTL (backend may clamp)
  renewWindowMinutes?: number  // Renew if within this window of expiry
  maxAgeHours?: number     // Absolute max age before forcing fresh mint
}

export interface WindowsDnsSystemMintTokenResponse {
  token: string
  tokenInfo: {
    id: string
    accountId: string
    name: string
    scopes: WindowsDnsTokenScope[]
    allowedZoneIds: string[] | '*'
    expiresAt?: number | null
    // New fields for drift tokens
    purpose?: WindowsDnsTokenPurpose
    fingerprint?: string | null
    zoneSelector?: WindowsDnsZoneSelector
    issuedAt?: number | null
    maxExpiresAt?: number | null
  }
  renewed?: boolean   // True if existing token was renewed instead of new mint
  created?: boolean   // True if a new token was created
}

export interface WindowsDnsZoneSummary {
  id: string
  zoneName: string
  serverId: string
  serverName: string
  zoneType: string
  owned: boolean
  claimable: boolean
  coreIdValue?: string | null
  /** Indicates if the COREID marker is present and valid */
  coreIdMarkerPresent?: boolean
  /** The actual COREID marker value found on the zone */
  coreIdMarkerValue?: string | null
}

export interface WindowsDnsRecord {
  id: string
  name: string
  type: string
  content: string
  ttl: number
  priority?: number | null
  comment?: string | null
}

export interface WindowsDnsApiError {
  code: string
  message: string
  details?: unknown
}

export interface WindowsDnsApiResponse<T> {
  success: boolean
  errors: WindowsDnsApiError[]
  messages: string[]
  result: T | null
  result_info?: {
    page: number
    perPage: number
    totalCount: number
  }
}

/**
 * Token scope mapping from portal permissions to WindowsDNS scopes
 */
export type WindowsDnsTokenScope =
  | 'zones.read'
  | 'zones.create'
  | 'zones.write'
  | 'records.read'
  | 'records.write'
  | 'ownership.read'
  | 'ownership.write'
  | 'autodiscover.read'

/**
 * Allowed zone entry (from windows_dns_allowed_zones table)
 */
export interface WindowsDnsAllowedZone {
  id: string
  organizationId: string
  zoneId: string
  zoneName?: string | null
  source: 'autodiscover' | 'manual'
  createdAt: Date
}

/**
 * Blocked zone entry (from windows_dns_blocked_zones table)
 * Zones that have been explicitly hidden by admin and should not be auto-activated.
 */
export interface WindowsDnsBlockedZone {
  id: string
  organizationId: string
  zoneId: string
  zoneName?: string | null
  source: 'manual'
  createdAt: Date
}

/**
 * Last discovery result (from windows_dns_last_discovery table)
 */
export interface WindowsDnsLastDiscovery {
  organizationId: string
  discoveredAt: Date
  zoneIds: string[]
  coreIdSnapshot?: string | null
}
