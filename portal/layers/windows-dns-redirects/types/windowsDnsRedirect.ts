/**
 * WindowsDnsRedirect Type Definitions
 * All types follow the WindowsDnsRedirect naming convention
 */

// Redirect type enum
export type WindowsDnsRedirectType = 'simple' | 'wildcard' | 'regex'

// HTTP Status codes for redirects
export type WindowsDnsRedirectStatusCode = 301 | 302 | 307 | 308

// Main redirect interface
export interface WindowsDnsRedirect {
  id: string
  organizationId: string
  zoneId: string
  zoneName: string
  /**
   * Full hostname for this redirect (e.g. "example.com", "www.example.com").
   * Used for matching in Traefik and for DNS record creation.
   */
  host: string
  sourcePath: string
  destinationUrl: string
  redirectType: WindowsDnsRedirectType
  statusCode: WindowsDnsRedirectStatusCode
  isActive: boolean
  hitCount: number
  lastHitAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

// Create redirect input
export interface WindowsDnsRedirectCreateInput {
  zoneId: string
  zoneName: string
  /**
   * Target host for the redirect. Accepts:
   * - Empty/@ → apex (zoneName)
   * - Subdomain label (e.g. "www") → www.zoneName
   * - Full hostname ending with zoneName
   */
  host?: string
  sourcePath: string
  destinationUrl: string
  redirectType: WindowsDnsRedirectType
  statusCode: WindowsDnsRedirectStatusCode
  isActive?: boolean
  /**
   * When true, the backend is allowed to apply required DNS record changes
   * (e.g. overwrite conflicting records) to make redirects work.
   */
  applyDnsChanges?: boolean
}

// Update redirect input
export interface WindowsDnsRedirectUpdateInput {
  /**
   * Target host for the redirect (same rules as create).
   */
  host?: string
  sourcePath?: string
  destinationUrl?: string
  redirectType?: WindowsDnsRedirectType
  statusCode?: WindowsDnsRedirectStatusCode
  isActive?: boolean
  /**
   * When true, the backend is allowed to apply required DNS record changes.
   */
  applyDnsChanges?: boolean
}

// Redirect hit tracking
export interface WindowsDnsRedirectHit {
  id: string
  redirectId: string
  hitDate: Date
  hitCount: number
  createdAt: Date
}

// Import/Export types
export interface WindowsDnsRedirectImportRow {
  /**
   * Target host (empty/@ for apex, or subdomain label, or full hostname).
   */
  host?: string
  sourcePath: string
  destinationUrl: string
  redirectType?: WindowsDnsRedirectType
  statusCode?: WindowsDnsRedirectStatusCode
}

export interface WindowsDnsRedirectImportResult {
  totalRows: number
  successfulRows: number
  failedRows: number
  errors: WindowsDnsRedirectImportError[]
}

export interface WindowsDnsRedirectImportError {
  row: number
  field: string
  message: string
  value?: string
}

export interface WindowsDnsRedirectImportLog {
  id: string
  organizationId: string
  zoneId: string
  filename: string
  totalRows: number
  successfulRows: number
  failedRows: number
  errorDetails: WindowsDnsRedirectImportError[]
  importedBy: string
  createdAt: Date
}

// Statistics types
export interface WindowsDnsRedirectStats {
  redirectId: string
  totalHits: number
  hitsToday: number
  hitsThisWeek: number
  hitsThisMonth: number
  lastHitAt: Date | null
  dailyHits: WindowsDnsRedirectDailyHitData[]
}

export interface WindowsDnsRedirectDailyHitData {
  date: string
  count: number
}

export interface WindowsDnsRedirectZoneStats {
  zoneId: string
  zoneName: string
  totalRedirects: number
  activeRedirects: number
  inactiveRedirects: number
  totalHits: number
  hitsToday: number
}

// Organization configuration
export interface WindowsDnsRedirectOrgConfig {
  id: string
  organizationId: string
  traefikConfigPath: string | null
  lastConfigSync: Date | null
  createdAt: Date
  updatedAt: Date
}

// API response types
export interface WindowsDnsRedirectApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface WindowsDnsRedirectPaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Filter and sort types
export interface WindowsDnsRedirectFilters {
  search?: string
  host?: string
  type?: WindowsDnsRedirectType
  statusCode?: WindowsDnsRedirectStatusCode
  isActive?: boolean
}

// DNS conflict details returned when a redirect would conflict with existing DNS records
export interface WindowsDnsRedirectDnsConflict {
  code: 'DNS_RECORD_CONFLICT'
  recordName: string
  before: WindowsDnsRedirectDnsRecord[]
  after: WindowsDnsRedirectDnsRecord[]
}

export interface WindowsDnsRedirectDnsRecord {
  id?: string
  name: string
  type: string
  content: string
  ttl: number
}

export type WindowsDnsRedirectSortField = 'createdAt' | 'updatedAt' | 'hitCount' | 'lastHitAt' | 'sourcePath'
export type WindowsDnsRedirectSortDirection = 'asc' | 'desc'

export interface WindowsDnsRedirectSortOptions {
  field: WindowsDnsRedirectSortField
  direction: WindowsDnsRedirectSortDirection
}

// Traefik types
export interface WindowsDnsRedirectTraefikSyncStatus {
  lastSync: Date | null
  status: 'synced' | 'pending' | 'error'
  message?: string
}

export interface WindowsDnsRedirectTraefikHealthStatus {
  healthy: boolean
  version?: string
  message?: string
  lastCheck: Date
}

// Validation types
export interface WindowsDnsRedirectValidationResult {
  valid: boolean
  errors: WindowsDnsRedirectValidationError[]
}

export interface WindowsDnsRedirectValidationError {
  field: string
  message: string
  code: string
}
