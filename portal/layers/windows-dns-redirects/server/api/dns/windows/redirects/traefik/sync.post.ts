/**
 * POST /api/dns/windows/redirects/traefik/sync
 * Sync redirects to Traefik configuration via SFTP
 *
 * Each organization gets their own config file: /dynamic/redirects-{orgId}.yml
 * SFTP connection settings are read from environment variables.
 */
import { createError, defineEventHandler, getQuery } from 'h3'
import { eq } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirectOrgConfig, windowsDnsRedirects, windowsDnsAllowedZones } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import * as yaml from 'yaml'
import {
  getSftpConfigFromEnv,
  buildRemotePath,
  uploadTraefikConfig,
  isSftpConfigured
} from '../../../../../utils/sftp-client'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId

  // Check module access and traefik sync permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canSyncTraefik) {
    throw createError({ statusCode: 403, message: 'No permission to sync Traefik.' })
  }

  // Check SFTP configuration from environment
  const sftpConfig = getSftpConfigFromEnv()
  if (!sftpConfig) {
    throw createError({
      statusCode: 500,
      message: 'SFTP not configured. Set TRAEFIK_SFTP_HOST, TRAEFIK_SFTP_USERNAME, TRAEFIK_SFTP_KEY_PATH, and TRAEFIK_SFTP_REMOTE_DIR environment variables.'
    })
  }

  const db = getDb()
  const query = getQuery(event)
  const dryRun = query.dryRun === '1' || query.dryRun === 'true'

  // Get or create org config (for tracking last sync)
  let [config] = await db
    .select()
    .from(windowsDnsRedirectOrgConfig)
    .where(eq(windowsDnsRedirectOrgConfig.organizationId, orgId))
    .limit(1)

  if (!config) {
    ;[config] = await db
      .insert(windowsDnsRedirectOrgConfig)
      .values({
        organizationId: orgId,
        traefikConfigPath: null,
        lastConfigSync: null
      })
      .returning()
  }

  // Get all active redirects for this organization
  const redirects = await db
    .select()
    .from(windowsDnsRedirects)
    .where(eq(windowsDnsRedirects.organizationId, orgId))

  // Get zone info for domains
  const zones = await db
    .select()
    .from(windowsDnsAllowedZones)
    .where(eq(windowsDnsAllowedZones.organizationId, orgId))

  const zoneMap = new Map(zones.map(z => [z.zoneId, z.zoneName || '']))

  // Generate Traefik configuration
  const traefikConfig = generateTraefikConfig(redirects, zoneMap)
  const yamlContent = yaml.stringify(traefikConfig)

  // Build org-specific remote path
  const remotePath = buildRemotePath(sftpConfig.remoteDir, orgId)

  if (dryRun) {
    return {
      dryRun: true,
      config: traefikConfig,
      redirectCount: redirects.filter(r => r.isActive).length,
      remotePath,
      host: sftpConfig.host,
      message: 'Dry run completed. Configuration not applied.'
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
      throw new Error(result.error || 'SFTP upload failed')
    }

    // Update last sync timestamp
    await db
      .update(windowsDnsRedirectOrgConfig)
      .set({
        lastConfigSync: new Date(),
        updatedAt: new Date()
      })
      .where(eq(windowsDnsRedirectOrgConfig.id, config!.id))

    return {
      success: true,
      remotePath,
      host: sftpConfig.host,
      bytesWritten: result.bytesWritten,
      redirectCount: redirects.filter(r => r.isActive).length,
      syncedAt: new Date().toISOString(),
      message: 'Traefik configuration synced via SFTP successfully.'
    }
  } catch (error: any) {
    console.error('[windows-dns-redirects] Traefik sync failed:', error)

    throw createError({
      statusCode: 500,
      message: `Failed to sync Traefik config: ${error.message}`
    })
  }
})

interface TraefikConfig {
  http: {
    routers: Record<string, any>
    middlewares: Record<string, any>
  }
}

function generateTraefikConfig(
  redirects: any[],
  zoneMap: Map<string, string>
): TraefikConfig {
  const config: TraefikConfig = {
    http: {
      routers: {},
      middlewares: {}
    }
  }

  const activeRedirects = redirects.filter(r => r.isActive)

  for (const redirect of activeRedirects) {
    // Use redirect.host (FQDN) for matching; fallback to zoneName for legacy redirects
    const zoneName = zoneMap.get(redirect.zoneId) || redirect.zoneName
    const hostMatch = redirect.host || zoneName
    const routerId = `redirect-${redirect.id}`
    const middlewareId = `redirect-middleware-${redirect.id}`

    // Build the rule based on redirect type
    // Host is now per-redirect (supports subdomains like www.example.com)
    let rule: string
    if (redirect.redirectType === 'simple') {
      rule = `Host(\`${hostMatch}\`) && Path(\`${redirect.sourcePath}\`)`
    } else if (redirect.redirectType === 'wildcard') {
      // Convert wildcard to regex for Traefik
      const regexPath = redirect.sourcePath
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
      rule = `Host(\`${hostMatch}\`) && PathRegexp(\`^${regexPath}$\`)`
    } else {
      // Regex type
      rule = `Host(\`${hostMatch}\`) && PathRegexp(\`${redirect.sourcePath}\`)`
    }

    // Router configuration
    config.http.routers[routerId] = {
      rule,
      entryPoints: ['websecure'],
      middlewares: [middlewareId],
      service: 'noop@internal',
      tls: {}
    }

    // Middleware for redirect
    // The regex needs to match the specific host for proper capture groups
    config.http.middlewares[middlewareId] = {
      redirectRegex: {
        regex: redirect.redirectType === 'simple'
          ? `^https?://${escapeRegex(hostMatch)}${escapeRegex(redirect.sourcePath)}$`
          : redirect.redirectType === 'wildcard'
            ? `^https?://${escapeRegex(hostMatch)}${redirect.sourcePath.replace(/\*/g, '(.*)').replace(/\?/g, '(.)')}$`
            : `^https?://${escapeRegex(hostMatch)}${redirect.sourcePath}$`,
        replacement: redirect.destinationUrl,
        permanent: redirect.statusCode === 301 || redirect.statusCode === 308
      }
    }
  }

  return config
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
