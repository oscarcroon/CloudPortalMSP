/**
 * GET /api/admin/traefik/status
 * 
 * Get Traefik custom domains sync status and configuration info.
 * Includes a quick connection test to show accurate status.
 */
import { defineEventHandler, createError } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import {
  fetchVerifiedCustomDomains,
  getConfigStats
} from '~~/server/utils/traefik-domains-config'
import {
  getSftpConfigFromEnv,
  isSftpConfigured,
  testSftpConnection
} from '~~/layers/windows-dns-redirects/server/utils/sftp-client'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  
  if (!auth?.user.isSuperAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Endast superadmins kan se Traefik-status.'
    })
  }
  
  const enabled = process.env.TRAEFIK_DOMAINS_ENABLED === 'true'
  const sftpConfigured = isSftpConfigured()
  const sftpConfig = getSftpConfigFromEnv()
  
  // Fetch domain stats
  const domains = await fetchVerifiedCustomDomains()
  const stats = getConfigStats(domains)
  
  // Test connection if configured
  let connectionStatus: 'connected' | 'disconnected' | 'unconfigured' = 'unconfigured'
  let connectionError: string | null = null
  
  if (sftpConfigured && sftpConfig) {
    try {
      const testResult = await testSftpConnection({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        privateKeyPath: sftpConfig.privateKeyPath
      })
      connectionStatus = testResult.success ? 'connected' : 'disconnected'
      if (!testResult.success) {
        connectionError = testResult.message || 'Connection failed'
      }
    } catch (err: any) {
      connectionStatus = 'disconnected'
      connectionError = err.message || 'Connection test failed'
    }
  }
  
  return {
    enabled,
    sftpConfigured,
    sftpHost: sftpConfig?.host ?? null,
    sftpRemoteDir: sftpConfig?.remoteDir ?? null,
    portalBackendUrl: process.env.TRAEFIK_PORTAL_BACKEND_URL ?? null,
    defaultDomain: process.env.TRAEFIK_DEFAULT_DOMAIN ?? null,
    connectionStatus,
    connectionError,
    stats,
    domains: domains.map(d => ({
      type: d.type,
      id: d.id,
      name: d.name,
      slug: d.slug,
      customDomain: d.customDomain
    }))
  }
})
