/**
 * Certificates Layer Type Definitions
 */

// ---- Provider types ----

export type CertProvider = 'digicert' | 'letsencrypt' | 'zerossl' | 'custom'

export type ValidationMethod = 'http-01' | 'dns-01'

export type InstallationTarget = 'iis' | 'pfx' | 'centralssl' | 'manual'

// ---- Order statuses ----

export type OrderStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type CertificateStatus = 'active' | 'expiring' | 'expired' | 'revoked' | 'replaced'

export type AgentStatus = 'active' | 'inactive'

// ---- Agent capabilities ----

export interface AgentCapabilities {
  supports: string[] // e.g. ['http-01', 'iis', 'pfx', 'centralssl']
  dnsProviders: string[] // e.g. ['cloudflare', 'windows-dns']
}

// ---- Heartbeat metadata ----

export interface HeartbeatMeta {
  simpleAcmeVersion?: string
  renewalTaskStatus?: string
  renewalCount?: number
  os?: string
  hostname?: string
}

// ---- Run payload (immutable snapshot sent to agent) ----

export interface RunPayload {
  runId: string
  orderId: string
  primaryDomain: string
  subjectAlternativeNames: string[]
  validationMethod: ValidationMethod
  validationMeta?: Record<string, unknown>
  installationTarget: InstallationTarget
  installationMeta?: Record<string, unknown>
  autoRenew: boolean
  renewalName?: string
  renewDaysBefore: number
  credential: {
    provider: CertProvider
    acmeDirectoryUrl: string
    eabKid?: string
    eabHmac?: string // Decrypted for the payload — agent needs it
  }
}

// ---- Result metadata from completed run ----

export interface RunResultMeta {
  serial?: string
  thumbprint?: string
  expiresAt?: string
  renewalId?: string
  issuer?: string
  providerOrderId?: string
  acmeAccountThumbprint?: string
}

// ---- Module access rights ----

export interface CertificatesModuleRights {
  canView: boolean
  canOrder: boolean
  canManageAgents: boolean
  canManageCredentials: boolean
  canAdmin: boolean
}

// ---- Validation metadata ----

export interface ValidationMeta {
  zoneId?: string
  zoneName?: string
  dnsProvider?: string
}

// ---- Installation metadata ----

export interface IisInstallationMeta {
  siteName?: string
  bindingIp?: string
  bindingPort?: number
  sniEnabled?: boolean
}

export interface CentralSslInstallationMeta {
  storePath?: string
}

export interface PfxInstallationMeta {
  outputPath?: string
  pfxPassword?: string // Never stored; only in run payload
}

// ---- Dashboard summary ----

export interface DashboardSummary {
  totalCertificates: number
  activeCertificates: number
  expiringCertificates: number
  expiredCertificates: number
  pendingOrders: number
  failedOrders: number
  agentsOnline: number
  agentsTotal: number
}

// ---- Rate limit config ----

export const RATE_LIMITS = {
  ORDERS_PER_HOUR: 10,
  ORDERS_PER_DAY: 50
} as const

// ---- Lease config ----

export const LEASE_DEFAULTS = {
  DURATION_MS: 10 * 60 * 1000, // 10 minutes
  EXTENSION_MS: 10 * 60 * 1000 // 10 minutes
} as const

// ---- Log safety patterns (agent logs are checked against these) ----

export const LOG_REDACT_PATTERNS = [
  /--eab-key\s+\S+/gi,
  /PRIVATE KEY/gi,
  /Authorization:\s*Bearer\s+\S+/gi,
  /--key\s+\S+/gi,
  /password\s*[:=]\s*\S+/gi
]
