/**
 * GET /api/dns/windows/redirects/traefik/status
 * Get Traefik sync status for the organization
 */
import { createError, defineEventHandler } from 'h3'
import { eq, sql } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirectOrgConfig, windowsDnsRedirects } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getSftpConfigFromEnv, buildRemotePath, isSftpConfigured } from '../../../../../utils/sftp-client'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId

  // Check module access and traefik view permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canViewTraefik) {
    throw createError({ statusCode: 403, message: 'No permission to view Traefik status.' })
  }

  const db = getDb()

  // Get config
  const [config] = await db
    .select()
    .from(windowsDnsRedirectOrgConfig)
    .where(eq(windowsDnsRedirectOrgConfig.organizationId, orgId))
    .limit(1)

  // Get redirect stats
  const [stats] = await db
    .select({
      totalRedirects: sql<number>`count(*)`,
      activeRedirects: sql<number>`sum(case when ${windowsDnsRedirects.isActive} = 1 then 1 else 0 end)`
    })
    .from(windowsDnsRedirects)
    .where(eq(windowsDnsRedirects.organizationId, orgId))

  // Get SFTP configuration from environment
  const sftpConfig = getSftpConfigFromEnv()
  const configured = sftpConfig !== null

  // Determine sync status
  let status: 'synced' | 'pending' | 'error' | 'not_configured' = 'not_configured'
  let message = 'SFTP not configured. Set environment variables.'

  if (configured) {
    if (config?.lastConfigSync) {
      status = 'synced'
      message = 'Configuration is synced'
    } else {
      status = 'pending'
      message = 'Initial sync required'
    }
  }

  // Build org-specific remote path
  const remotePath = sftpConfig ? buildRemotePath(sftpConfig.remoteDir, orgId) : null

  return {
    status,
    message,
    configured,
    lastSync: config?.lastConfigSync?.toISOString?.() || config?.lastConfigSync || null,
    sftp: sftpConfig ? {
      host: sftpConfig.host,
      port: sftpConfig.port,
      remotePath
    } : null,
    stats: {
      totalRedirects: Number(stats?.totalRedirects) || 0,
      activeRedirects: Number(stats?.activeRedirects) || 0
    }
  }
})
