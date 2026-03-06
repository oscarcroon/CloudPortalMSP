/**
 * PUT /api/dns/windows/redirects/config
 * Update redirect configuration for the organization
 *
 * Note: SFTP settings are configured via environment variables, not per-organization.
 * This endpoint is kept for potential future per-org settings.
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirectOrgConfig } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getSftpConfigFromEnv, buildRemotePath } from '../../../../utils/sftp-client'

interface ConfigUpdateBody {
  // Reserved for future per-org settings
}

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId

  // Check module access and config edit permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canEditRedirectConfig) {
    throw createError({ statusCode: 403, message: 'No permission to edit redirect config.' })
  }

  const db = getDb()
  const body = await readBody<ConfigUpdateBody>(event)

  // Get or create config
  let [config] = await db
    .select()
    .from(windowsDnsRedirectOrgConfig)
    .where(eq(windowsDnsRedirectOrgConfig.organizationId, orgId))
    .limit(1)

  if (!config) {
    // Create config
    await db
      .insert(windowsDnsRedirectOrgConfig)
      .values({
        organizationId: orgId,
        traefikConfigPath: null,
        lastConfigSync: null
      })
  } else {
    // Update timestamp
    await db
      .update(windowsDnsRedirectOrgConfig)
      .set({
        updatedAt: new Date()
      })
      .where(eq(windowsDnsRedirectOrgConfig.id, config.id))
  }

  // Re-fetch config after insert/update
  ;[config] = await db
    .select()
    .from(windowsDnsRedirectOrgConfig)
    .where(eq(windowsDnsRedirectOrgConfig.organizationId, orgId))
    .limit(1)

  // Get SFTP configuration from environment (read-only, for display purposes)
  const sftpConfig = getSftpConfigFromEnv()
  const remotePath = sftpConfig ? buildRemotePath(sftpConfig.remoteDir, orgId) : null

  return {
    config: {
      id: config!.id,
      organizationId: config!.organizationId,
      lastConfigSync: config!.lastConfigSync?.toISOString?.() || config!.lastConfigSync,
      createdAt: config!.createdAt?.toISOString?.() || config!.createdAt,
      updatedAt: config!.updatedAt?.toISOString?.() || config!.updatedAt
    },
    // SFTP settings from environment (read-only)
    sftp: sftpConfig ? {
      configured: true,
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      remotePath
    } : {
      configured: false
    }
  }
})
