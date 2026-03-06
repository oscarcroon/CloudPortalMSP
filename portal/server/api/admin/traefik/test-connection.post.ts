/**
 * POST /api/admin/traefik/test-connection
 * 
 * Test SFTP connection to Traefik edge server.
 */
import { defineEventHandler, createError } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import {
  getSftpConfigFromEnv,
  testSftpConnection
} from '~~/layers/windows-dns-redirects/server/utils/sftp-client'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  
  if (!auth?.user.isSuperAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Endast superadmins kan testa SFTP-anslutning.'
    })
  }
  
  const sftpConfig = getSftpConfigFromEnv()
  if (!sftpConfig) {
    throw createError({
      statusCode: 500,
      message: 'SFTP är inte konfigurerat. Sätt TRAEFIK_SFTP_* miljövariabler.'
    })
  }
  
  const result = await testSftpConnection({
    host: sftpConfig.host,
    port: sftpConfig.port,
    username: sftpConfig.username,
    privateKeyPath: sftpConfig.privateKeyPath
  })
  
  return {
    ...result,
    host: sftpConfig.host,
    port: sftpConfig.port,
    username: sftpConfig.username,
    remoteDir: sftpConfig.remoteDir
  }
})
