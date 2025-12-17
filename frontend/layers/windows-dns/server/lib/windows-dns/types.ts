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
}

export interface WindowsDnsZoneAccess extends WindowsDnsModuleRights {
  zoneRole: WindowsDnsZoneRole | null
}

/**
 * Org config stored in CloudPortalMSP database.
 * Note: Admin provisioner key is NOT stored here - it's a server-only env var.
 */
export interface WindowsDnsOrgConfig {
  /** Base URL of the Windows DNS API (e.g., https://dns-api.example.com) */
  baseUrl: string
  /** Optional instance identifier for multi-instance setups */
  instanceId?: string | null
  /** The WindowsDNS accountId for this org (stored after ensure) */
  windowsDnsAccountId?: string | null
  /** COREID for this org (source of truth is WindowsDNS externalRef) */
  coreId?: string | null
  /** Last time the connection was validated */
  lastValidatedAt?: Date | null
  /** Last sync timestamp */
  lastSyncAt?: Date | null
  /** Last sync status */
  lastSyncStatus?: string | null
  /** Last sync error message */
  lastSyncError?: string | null
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
}

export interface WindowsDnsRecord {
  id: string
  name: string
  type: string
  content: string
  ttl: number
  priority?: number | null
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

