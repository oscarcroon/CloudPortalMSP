/**
 * POST /api/dns/windows/redirects/sftp/test-connection
 * Test SFTP connection using environment-configured settings
 */
import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { testSftpConnection, getSftpConfigFromEnv, buildRemotePath } from '../../../../../utils/sftp-client'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId

  // Check module access and config edit permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canEditRedirectConfig) {
    throw createError({ statusCode: 403, message: 'No permission to test SFTP connection.' })
  }

  // Get SFTP configuration from environment
  const sftpConfig = getSftpConfigFromEnv()
  if (!sftpConfig) {
    throw createError({
      statusCode: 500,
      message: 'SFTP not configured. Set TRAEFIK_SFTP_HOST, TRAEFIK_SFTP_USERNAME, TRAEFIK_SFTP_KEY_PATH, and TRAEFIK_SFTP_REMOTE_DIR environment variables.'
    })
  }

  // Test the connection
  const result = await testSftpConnection({
    host: sftpConfig.host,
    port: sftpConfig.port,
    username: sftpConfig.username,
    privateKeyPath: sftpConfig.privateKeyPath
  })

  // Build org-specific remote path for display
  const remotePath = buildRemotePath(sftpConfig.remoteDir, orgId)

  return {
    success: result.success,
    message: result.message,
    serverInfo: result.serverInfo,
    config: {
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      remotePath
    },
    testedAt: new Date().toISOString()
  }
})
