/**
 * Domain Verification Scheduler
 * 
 * Background job that checks pending domain verifications
 * for both tenants and organizations.
 */
import { eq, or, inArray } from 'drizzle-orm'
import { tenants, organizations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import {
  verifyDomainOwnership,
  type DomainVerificationStatus
} from '~~/server/utils/domain-verification'

// Max domains to check per run (to avoid overloading DNS)
const MAX_DOMAINS_PER_RUN = 20

// Statuses that should be checked
const PENDING_STATUSES: DomainVerificationStatus[] = ['pending', 'verifying']

interface DomainToVerify {
  type: 'tenant' | 'organization'
  id: string
  customDomain: string
  verificationToken: string
}

/**
 * Run domain verification check for all pending domains
 */
export async function runDomainVerificationCheck(): Promise<{
  checked: number
  verified: number
  failed: number
}> {
  const db = getDb()
  const stats = { checked: 0, verified: 0, failed: 0 }
  
  // Collect all domains to verify
  const domainsToVerify: DomainToVerify[] = []
  
  // Get pending tenant domains
  const pendingTenants = await db
    .select({
      id: tenants.id,
      customDomain: tenants.customDomain,
      verificationToken: tenants.customDomainVerificationToken
    })
    .from(tenants)
    .where(
      inArray(tenants.customDomainVerificationStatus, PENDING_STATUSES)
    )
    .limit(MAX_DOMAINS_PER_RUN)
  
  for (const tenant of pendingTenants) {
    if (tenant.customDomain && tenant.verificationToken) {
      domainsToVerify.push({
        type: 'tenant',
        id: tenant.id,
        customDomain: tenant.customDomain,
        verificationToken: tenant.verificationToken
      })
    }
  }
  
  // Get pending organization domains
  const remainingSlots = MAX_DOMAINS_PER_RUN - domainsToVerify.length
  if (remainingSlots > 0) {
    const pendingOrgs = await db
      .select({
        id: organizations.id,
        customDomain: organizations.customDomain,
        verificationToken: organizations.customDomainVerificationToken
      })
      .from(organizations)
      .where(
        inArray(organizations.customDomainVerificationStatus, PENDING_STATUSES)
      )
      .limit(remainingSlots)
    
    for (const org of pendingOrgs) {
      if (org.customDomain && org.verificationToken) {
        domainsToVerify.push({
          type: 'organization',
          id: org.id,
          customDomain: org.customDomain,
          verificationToken: org.verificationToken
        })
      }
    }
  }
  
  if (domainsToVerify.length === 0) {
    return stats
  }
  
  console.log(`[domain-verification] Checking ${domainsToVerify.length} pending domains...`)
  
  // Process domains sequentially to avoid DNS rate limiting
  for (const domain of domainsToVerify) {
    stats.checked++
    
    try {
      const result = await verifyDomainOwnership(
        domain.customDomain,
        domain.verificationToken
      )
      
      if (result.verified) {
        stats.verified++
        const verifiedAt = new Date()
        
        if (domain.type === 'tenant') {
          await db
            .update(tenants)
            .set({
              customDomainVerificationStatus: 'verified',
              customDomainVerifiedAt: verifiedAt,
              updatedAt: verifiedAt
            })
            .where(eq(tenants.id, domain.id))
        } else {
          await db
            .update(organizations)
            .set({
              customDomainVerificationStatus: 'verified',
              customDomainVerifiedAt: verifiedAt,
              updatedAt: verifiedAt
            })
            .where(eq(organizations.id, domain.id))
        }
        
        console.log(`[domain-verification] Verified: ${domain.customDomain} (${domain.type})`)
        
        // Trigger Traefik config sync after verification
        try {
          await triggerTraefikSync()
        } catch (syncError) {
          console.error(`[domain-verification] Traefik sync failed after verifying ${domain.customDomain}:`, syncError)
        }
      } else {
        stats.failed++
        // Keep status as pending - don't mark as failed yet
        // (user might still be setting up DNS)
      }
    } catch (error) {
      stats.failed++
      console.error(`[domain-verification] Error checking ${domain.customDomain}:`, error)
    }
    
    // Small delay between checks to be nice to DNS servers
    await delay(500)
  }
  
  console.log(`[domain-verification] Check complete: ${stats.checked} checked, ${stats.verified} verified, ${stats.failed} pending`)
  
  return stats
}

/**
 * Trigger Traefik configuration sync after domain verification
 */
async function triggerTraefikSync(): Promise<void> {
  if (process.env.TRAEFIK_DOMAINS_ENABLED !== 'true') {
    return
  }
  
  try {
    const { fetchVerifiedCustomDomains, generateTraefikDomainsYaml, getConfigStats, buildCustomDomainsRemotePath } = await import('~~/server/utils/traefik-domains-config')
    const { getSftpConfigFromEnv, uploadTraefikConfig } = await import('~~/layers/windows-dns-redirects/server/utils/sftp-client')
    
    const sftpConfig = getSftpConfigFromEnv()
    if (!sftpConfig) {
      console.log('[domain-verification] SFTP not configured, skipping Traefik sync')
      return
    }
    
    const domains = await fetchVerifiedCustomDomains()
    const stats = getConfigStats(domains)
    
    const yamlContent = generateTraefikDomainsYaml(domains, {
      portalBackendUrl: process.env.TRAEFIK_PORTAL_BACKEND_URL,
      defaultDomain: process.env.TRAEFIK_DEFAULT_DOMAIN
    })
    
    const remotePath = buildCustomDomainsRemotePath(sftpConfig.remoteDir)
    
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
    
    if (result.success) {
      console.log(`[domain-verification] Traefik sync complete: ${stats.total} domains synced`)
    } else {
      console.error('[domain-verification] Traefik sync failed:', result.error)
    }
  } catch (error) {
    console.error('[domain-verification] Traefik sync error:', error)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
