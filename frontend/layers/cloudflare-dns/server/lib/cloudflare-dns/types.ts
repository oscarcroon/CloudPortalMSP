export type CloudflareDnsModuleRole = 'viewer' | 'records-editor' | 'zone-admin' | 'module-admin'

export type CloudflareZoneRole = 'viewer' | 'records-only' | 'editor' | 'admin'

export interface CloudflareModuleRights {
  roles: CloudflareDnsModuleRole[]
  canView: boolean
  canEditRecords: boolean
  canManageZones: boolean
  canManageAcls: boolean
  canManageOrgConfig: boolean
}

export interface CloudflareZoneAccess extends CloudflareModuleRights {
  zoneRole: CloudflareZoneRole | null
}

export interface CloudflareOrgConfig {
  apiToken: string
  accountId?: string | null
  lastValidatedAt?: Date | null
  lastSyncAt?: Date | null
  lastSyncStatus?: string | null
  lastSyncError?: string | null
}

export interface CloudflareZoneSummary {
  id: string
  name: string
  status?: string | null
  plan?: string | null
  recordCount?: number | null
  effectiveRole?: CloudflareZoneRole | null
  canEdit?: boolean
  canManage?: boolean
  aclRestricted?: boolean
}

export interface CloudflareDnsRecord {
  id: string
  type: string
  name: string
  content: string
  ttl?: number | null
  proxied?: boolean | null
  priority?: number | null
}

export interface CloudflareApiErrorPayload {
  code?: number
  message?: string
}


