/**
 * Traefik Dynamic Configuration Generator for Custom Domains
 * 
 * Generates YAML configuration for Traefik routers that route
 * custom domain traffic to the Nuxt portal application.
 */
import * as yaml from 'yaml'
import { eq, and, isNotNull } from 'drizzle-orm'
import { tenants, organizations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'

export interface TraefikRouter {
  rule: string
  service: string
  entryPoints: string[]
  tls?: {
    certResolver?: string
  }
  middlewares?: string[]
  priority?: number
}

export interface TraefikService {
  loadBalancer: {
    servers: Array<{ url: string }>
    passHostHeader?: boolean
  }
}

export interface TraefikMiddleware {
  headers?: {
    customRequestHeaders?: Record<string, string>
    customResponseHeaders?: Record<string, string>
    sslRedirect?: boolean
    stsSeconds?: number
    stsIncludeSubdomains?: boolean
    stsPreload?: boolean
    forceSTSHeader?: boolean
    contentTypeNosniff?: boolean
    browserXssFilter?: boolean
    referrerPolicy?: string
    frameDeny?: boolean
  }
  rateLimit?: {
    average: number
    burst: number
    period?: string
  }
}

export interface TraefikConfig {
  http: {
    routers: Record<string, TraefikRouter>
    services: Record<string, TraefikService>
    middlewares: Record<string, TraefikMiddleware>
  }
}

export interface CustomDomainEntry {
  type: 'tenant' | 'organization'
  id: string
  name: string
  slug: string
  customDomain: string
}

/**
 * Get runtime configuration for Traefik
 */
function getTraefikConfig() {
  return {
    enabled: process.env.TRAEFIK_DOMAINS_ENABLED === 'true',
    portalBackendUrl: process.env.TRAEFIK_PORTAL_BACKEND_URL || 'http://localhost:3000',
    defaultDomain: process.env.TRAEFIK_DEFAULT_DOMAIN || 'portal.example.com',
    acmeEmail: process.env.TRAEFIK_ACME_EMAIL || 'admin@example.com'
  }
}

/**
 * Fetch all verified custom domains from database
 */
export async function fetchVerifiedCustomDomains(): Promise<CustomDomainEntry[]> {
  const db = getDb()
  const domains: CustomDomainEntry[] = []
  
  // Get verified tenant domains
  const verifiedTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      customDomain: tenants.customDomain
    })
    .from(tenants)
    .where(
      and(
        isNotNull(tenants.customDomain),
        eq(tenants.customDomainVerificationStatus, 'verified')
      )
    )
  
  for (const tenant of verifiedTenants) {
    if (tenant.customDomain) {
      domains.push({
        type: 'tenant',
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        customDomain: tenant.customDomain
      })
    }
  }
  
  // Get verified organization domains
  const verifiedOrgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      customDomain: organizations.customDomain
    })
    .from(organizations)
    .where(
      and(
        isNotNull(organizations.customDomain),
        eq(organizations.customDomainVerificationStatus, 'verified')
      )
    )
  
  for (const org of verifiedOrgs) {
    if (org.customDomain) {
      domains.push({
        type: 'organization',
        id: org.id,
        name: org.name,
        slug: org.slug,
        customDomain: org.customDomain
      })
    }
  }
  
  return domains
}

/**
 * Generate router ID from domain entry
 */
function generateRouterId(entry: CustomDomainEntry): string {
  // Use slug instead of ID for readability, sanitize for Traefik
  const sanitizedSlug = entry.slug.replace(/[^a-z0-9-]/g, '-')
  return `${entry.type}-${sanitizedSlug}`
}

/**
 * Generate Traefik dynamic configuration for custom domains
 */
export function generateTraefikDomainsConfig(
  domains: CustomDomainEntry[],
  options?: {
    portalBackendUrl?: string
    defaultDomain?: string
  }
): TraefikConfig {
  const config = getTraefikConfig()
  const portalBackendUrl = options?.portalBackendUrl || config.portalBackendUrl
  const defaultDomain = options?.defaultDomain || config.defaultDomain
  
  const traefikConfig: TraefikConfig = {
    http: {
      routers: {},
      services: {},
      middlewares: {}
    }
  }
  
  // Add the portal backend service
  traefikConfig.http.services['portal-service'] = {
    loadBalancer: {
      servers: [{ url: portalBackendUrl }],
      passHostHeader: true
    }
  }
  
  // Add security middleware
  traefikConfig.http.middlewares['security-headers'] = {
    headers: {
      sslRedirect: true,
      stsSeconds: 31536000,
      stsIncludeSubdomains: true,
      stsPreload: true,
      forceSTSHeader: true,
      contentTypeNosniff: true,
      browserXssFilter: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      frameDeny: false // Allow framing for certain features
    }
  }
  
  // Add rate limiting middleware (optional, can be adjusted)
  traefikConfig.http.middlewares['rate-limit'] = {
    rateLimit: {
      average: 100,
      burst: 200,
      period: '1s'
    }
  }
  
  // Add default portal router (for the main domain)
  traefikConfig.http.routers['portal-default'] = {
    rule: `Host(\`${defaultDomain}\`)`,
    service: 'portal-service',
    entryPoints: ['websecure'],
    tls: {
      certResolver: 'letsencrypt'
    },
    middlewares: ['security-headers'],
    priority: 1 // Lowest priority, acts as fallback
  }
  
  // Add routers for each custom domain
  for (const domain of domains) {
    const routerId = generateRouterId(domain)
    
    traefikConfig.http.routers[routerId] = {
      rule: `Host(\`${domain.customDomain}\`)`,
      service: 'portal-service',
      entryPoints: ['websecure'],
      tls: {
        certResolver: 'letsencrypt'
      },
      middlewares: ['security-headers'],
      priority: 10 // Higher priority than default
    }
  }
  
  return traefikConfig
}

/**
 * Generate YAML string from Traefik config
 */
export function generateTraefikDomainsYaml(
  domains: CustomDomainEntry[],
  options?: {
    portalBackendUrl?: string
    defaultDomain?: string
  }
): string {
  const config = generateTraefikDomainsConfig(domains, options)
  
  // Add header comment
  const header = `# Traefik Custom Domains Configuration
# Auto-generated by CloudPortal MSP
# Generated: ${new Date().toISOString()}
# Domains: ${domains.length}
#
# DO NOT EDIT MANUALLY - Changes will be overwritten

`
  
  return header + yaml.stringify(config)
}

/**
 * Validate domain format before adding to config
 */
export function isValidDomainForTraefik(domain: string): boolean {
  // Basic validation - should match a valid hostname
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/
  
  if (!domainRegex.test(domain)) {
    return false
  }
  
  // Must have at least one dot
  if (!domain.includes('.')) {
    return false
  }
  
  // Max length check
  if (domain.length > 253) {
    return false
  }
  
  // No label longer than 63 characters
  const labels = domain.split('.')
  for (const label of labels) {
    if (label.length > 63) {
      return false
    }
  }
  
  return true
}

/**
 * Generate configuration stats for logging/monitoring
 */
export function getConfigStats(domains: CustomDomainEntry[]): {
  total: number
  tenants: number
  organizations: number
  uniqueDomains: string[]
} {
  return {
    total: domains.length,
    tenants: domains.filter(d => d.type === 'tenant').length,
    organizations: domains.filter(d => d.type === 'organization').length,
    uniqueDomains: [...new Set(domains.map(d => d.customDomain))]
  }
}

/**
 * Build remote path for custom domains config file
 */
export function buildCustomDomainsRemotePath(remoteDir: string): string {
  const dir = remoteDir.replace(/\/+$/, '')
  return `${dir}/custom-domains.yml`
}

/**
 * Sync Traefik custom domains configuration if enabled.
 * This function is safe to call from anywhere - it will only sync if:
 * - TRAEFIK_DOMAINS_ENABLED is true
 * - SFTP is properly configured
 * 
 * @returns Object with success status and message
 */
export async function syncTraefikDomainsIfEnabled(): Promise<{
  synced: boolean
  message: string
  error?: string
}> {
  // Check if Traefik domains sync is enabled
  if (process.env.TRAEFIK_DOMAINS_ENABLED !== 'true') {
    return {
      synced: false,
      message: 'Traefik sync är inte aktiverat.'
    }
  }
  
  // Dynamic import to avoid circular dependencies
  const { getSftpConfigFromEnv, uploadTraefikConfig } = await import(
    '~~/layers/windows-dns-redirects/server/utils/sftp-client'
  )
  
  const sftpConfig = getSftpConfigFromEnv()
  if (!sftpConfig) {
    return {
      synced: false,
      message: 'SFTP är inte konfigurerat.'
    }
  }
  
  try {
    // Fetch all verified custom domains
    const domains = await fetchVerifiedCustomDomains()
    const stats = getConfigStats(domains)
    
    // Generate Traefik YAML configuration
    const yamlContent = generateTraefikDomainsYaml(domains, {
      portalBackendUrl: process.env.TRAEFIK_PORTAL_BACKEND_URL,
      defaultDomain: process.env.TRAEFIK_DEFAULT_DOMAIN
    })
    
    // Build remote path
    const remotePath = buildCustomDomainsRemotePath(sftpConfig.remoteDir)
    
    // Upload via SFTP
    const result = await uploadTraefikConfig(
      {
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        privateKeyPath: sftpConfig.privateKeyPath
      },
      remotePath,
      yamlContent
    )
    
    if (!result.success) {
      console.error('[traefik-sync] Auto-sync failed:', result.error)
      return {
        synced: false,
        message: 'SFTP upload misslyckades.',
        error: result.error
      }
    }
    
    console.log(`[traefik-sync] Auto-synced ${stats.total} domains to ${sftpConfig.host}:${remotePath}`)
    
    return {
      synced: true,
      message: `Traefik-konfiguration synkroniserad: ${stats.total} domäner.`
    }
  } catch (error: any) {
    console.error('[traefik-sync] Auto-sync error:', error)
    return {
      synced: false,
      message: 'Synkronisering misslyckades.',
      error: error.message
    }
  }
}
