/**
 * POST /api/admin/traefik/sync-domains
 * 
 * Sync verified custom domains configuration to Traefik edge server via SFTP.
 * This generates a YAML configuration file containing all verified custom domains
 * (from both tenants and organizations) and uploads it to the Traefik server.
 */
import { defineEventHandler, createError, getQuery } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import {
  fetchVerifiedCustomDomains,
  generateTraefikDomainsYaml,
  getConfigStats,
  buildCustomDomainsRemotePath
} from '~~/server/utils/traefik-domains-config'
import {
  getSftpConfigFromEnv,
  uploadTraefikConfig
} from '~~/layers/windows-dns-redirects/server/utils/sftp-client'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  
  if (!auth?.user.isSuperAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Endast superadmins kan synkronisera Traefik-konfiguration.'
    })
  }
  
  // Check if Traefik domains sync is enabled
  if (process.env.TRAEFIK_DOMAINS_ENABLED !== 'true') {
    throw createError({
      statusCode: 400,
      message: 'Traefik custom domains sync är inte aktiverat. Sätt TRAEFIK_DOMAINS_ENABLED=true.'
    })
  }
  
  // Check SFTP configuration
  const sftpConfig = getSftpConfigFromEnv()
  if (!sftpConfig) {
    throw createError({
      statusCode: 500,
      message: 'SFTP är inte konfigurerat. Sätt TRAEFIK_SFTP_* miljövariabler.'
    })
  }
  
  const query = getQuery(event)
  const dryRun = query.dryRun === '1' || query.dryRun === 'true'
  
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
  
  if (dryRun) {
    return {
      dryRun: true,
      stats,
      remotePath,
      host: sftpConfig.host,
      config: yamlContent,
      message: 'Dry run genomförd. Konfigurationen har inte applicerats.'
    }
  }
  
  // Upload via SFTP
  try {
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
      throw new Error(result.error || 'SFTP upload misslyckades')
    }
    
    // Log audit event
    await logAuditEvent(event, 'TRAEFIK_CUSTOM_DOMAINS_SYNCED', {
      remotePath,
      host: sftpConfig.host,
      domainCount: stats.total,
      tenantDomains: stats.tenants,
      organizationDomains: stats.organizations,
      syncedAt: new Date().toISOString()
    })
    
    console.log(`[traefik-sync] Custom domains synced: ${stats.total} domains to ${sftpConfig.host}:${remotePath}`)
    
    return {
      success: true,
      stats,
      remotePath,
      host: sftpConfig.host,
      bytesWritten: result.bytesWritten,
      syncedAt: new Date().toISOString(),
      message: `Traefik-konfiguration synkroniserad: ${stats.total} domäner.`
    }
  } catch (error: any) {
    console.error('[traefik-sync] Custom domains sync failed:', error)
    
    throw createError({
      statusCode: 500,
      message: `Synkronisering misslyckades: ${error.message}`
    })
  }
})
