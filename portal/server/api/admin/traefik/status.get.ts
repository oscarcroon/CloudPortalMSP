/**
 * GET /api/admin/traefik/status
 * 
 * Get Traefik custom domains sync status and configuration info.
 */
import { defineEventHandler, createError } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import {
  fetchVerifiedCustomDomains,
  getConfigStats
} from '~~/server/utils/traefik-domains-config'
import {
  getSftpConfigFromEnv,
  isSftpConfigured
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
  
  return {
    enabled,
    sftpConfigured,
    sftpHost: sftpConfig?.host ?? null,
    sftpRemoteDir: sftpConfig?.remoteDir ?? null,
    portalBackendUrl: process.env.TRAEFIK_PORTAL_BACKEND_URL ?? null,
    defaultDomain: process.env.TRAEFIK_DEFAULT_DOMAIN ?? null,
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
