/**
 * SFTP Client Wrapper for Traefik Configuration Sync
 * Provides atomic upload functionality with SSH key authentication
 */
import SftpClient from 'ssh2-sftp-client'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

// Environment variable names
const ENV_SFTP_HOST = 'TRAEFIK_SFTP_HOST'
const ENV_SFTP_PORT = 'TRAEFIK_SFTP_PORT'
const ENV_SFTP_USERNAME = 'TRAEFIK_SFTP_USERNAME'
const ENV_SFTP_KEY_PATH = 'TRAEFIK_SFTP_KEY_PATH'
const ENV_SFTP_REMOTE_DIR = 'TRAEFIK_SFTP_REMOTE_DIR'

export interface SftpConfig {
  host: string
  port: number
  username: string
  privateKeyPath: string
}

export interface SftpEnvConfig extends SftpConfig {
  remoteDir: string
}

/**
 * Get SFTP configuration from environment variables
 */
export function getSftpConfigFromEnv(): SftpEnvConfig | null {
  const host = process.env[ENV_SFTP_HOST]?.trim()
  const username = process.env[ENV_SFTP_USERNAME]?.trim()
  const keyPath = process.env[ENV_SFTP_KEY_PATH]?.trim()
  const remoteDir = process.env[ENV_SFTP_REMOTE_DIR]?.trim()

  if (!host || !username || !keyPath || !remoteDir) {
    return null
  }

  const portRaw = process.env[ENV_SFTP_PORT]?.trim()
  const port = portRaw ? parseInt(portRaw, 10) : 22

  return {
    host,
    port: Number.isFinite(port) ? port : 22,
    username,
    privateKeyPath: keyPath,
    remoteDir
  }
}

/**
 * Check if SFTP sync is configured via environment variables
 */
export function isSftpConfigured(): boolean {
  return getSftpConfigFromEnv() !== null
}

/**
 * Build the remote file path for an organization's Traefik config
 * Each org gets their own file: /dynamic/redirects-{orgId}.yml
 */
export function buildRemotePath(remoteDir: string, orgId: string): string {
  // Ensure remoteDir doesn't end with slash
  const dir = remoteDir.replace(/\/+$/, '')
  return `${dir}/redirects-${orgId}.yml`
}

export interface SftpConnectionResult {
  success: boolean
  message: string
  serverInfo?: string
}

export interface SftpUploadResult {
  success: boolean
  error?: string
  bytesWritten?: number
}

/**
 * Read SSH private key from file path
 */
async function readPrivateKey(keyPath: string): Promise<string> {
  if (!existsSync(keyPath)) {
    throw new Error(`SSH key file not found: ${keyPath}`)
  }

  const keyContent = await readFile(keyPath, 'utf-8')

  // Validate key format (PEM or OpenSSH)
  if (!keyContent.includes('-----BEGIN') && !keyContent.includes('openssh-key')) {
    throw new Error('Invalid SSH key format. Expected PEM or OpenSSH format.')
  }

  return keyContent
}

/**
 * Create SFTP client with SSH key authentication
 */
async function createSftpClient(config: SftpConfig): Promise<SftpClient> {
  const privateKey = await readPrivateKey(config.privateKeyPath)

  const sftp = new SftpClient()

  await sftp.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    privateKey,
    readyTimeout: 10000,
    retries: 1,
    retry_minTimeout: 2000,
  })

  return sftp
}

/**
 * Test SFTP connection
 * @returns Connection result with success status and message
 */
export async function testSftpConnection(config: SftpConfig): Promise<SftpConnectionResult> {
  let sftp: SftpClient | null = null

  try {
    // Validate key file exists before connecting
    if (!existsSync(config.privateKeyPath)) {
      return {
        success: false,
        message: `SSH key file not found: ${config.privateKeyPath}`
      }
    }

    sftp = await createSftpClient(config)

    // Try to get remote working directory to verify connection
    const cwd = await sftp.cwd()

    return {
      success: true,
      message: 'Connection successful',
      serverInfo: `Connected to ${config.host}:${config.port}, working directory: ${cwd}`
    }
  } catch (error: any) {
    const errorMessage = error.message || String(error)

    // Provide helpful error messages
    if (errorMessage.includes('ECONNREFUSED')) {
      return {
        success: false,
        message: `Connection refused. Check that SFTP server is running on ${config.host}:${config.port}`
      }
    }
    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      return {
        success: false,
        message: `Connection timed out. Check network connectivity to ${config.host}:${config.port}`
      }
    }
    if (errorMessage.includes('authentication') || errorMessage.includes('All configured authentication methods failed')) {
      return {
        success: false,
        message: 'Authentication failed. Check username and SSH key.'
      }
    }
    if (errorMessage.includes('ENOTFOUND')) {
      return {
        success: false,
        message: `Host not found: ${config.host}`
      }
    }

    return {
      success: false,
      message: `Connection failed: ${errorMessage}`
    }
  } finally {
    if (sftp) {
      try {
        await sftp.end()
      } catch {
        // Ignore disconnect errors
      }
    }
  }
}

/**
 * Upload Traefik configuration with atomic rename
 * 1. Upload to {remotePath}.tmp
 * 2. Rename .tmp to final file
 * 3. Clean up .tmp on failure
 */
export async function uploadTraefikConfig(
  config: SftpConfig,
  remotePath: string,
  content: string
): Promise<SftpUploadResult> {
  let sftp: SftpClient | null = null
  const tmpPath = `${remotePath}.tmp`

  try {
    sftp = await createSftpClient(config)

    // Convert content to buffer
    const buffer = Buffer.from(content, 'utf-8')

    // Upload to temporary file
    await sftp.put(buffer, tmpPath)

    // Atomic rename: .tmp -> final
    // First check if target exists and remove it (sftp rename may fail if target exists)
    const exists = await sftp.exists(remotePath)
    if (exists) {
      await sftp.delete(remotePath)
    }

    await sftp.rename(tmpPath, remotePath)

    return {
      success: true,
      bytesWritten: buffer.length
    }
  } catch (error: any) {
    const errorMessage = error.message || String(error)

    // Try to clean up temp file
    if (sftp) {
      try {
        const tmpExists = await sftp.exists(tmpPath)
        if (tmpExists) {
          await sftp.delete(tmpPath)
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    // Provide helpful error messages
    if (errorMessage.includes('EACCES') || errorMessage.includes('Permission denied')) {
      return {
        success: false,
        error: `Permission denied writing to ${remotePath}. Check SFTP user permissions.`
      }
    }
    if (errorMessage.includes('ENOENT') || errorMessage.includes('No such file')) {
      return {
        success: false,
        error: `Remote directory does not exist. Ensure the directory path exists on the server.`
      }
    }

    return {
      success: false,
      error: `Upload failed: ${errorMessage}`
    }
  } finally {
    if (sftp) {
      try {
        await sftp.end()
      } catch {
        // Ignore disconnect errors
      }
    }
  }
}

/**
 * Validate SSH key file path
 * Checks that file exists and appears to contain a valid SSH key
 */
export async function validateSshKeyPath(keyPath: string): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!existsSync(keyPath)) {
      return {
        valid: false,
        error: `SSH key file not found: ${keyPath}`
      }
    }

    const content = await readFile(keyPath, 'utf-8')

    // Check for common SSH key formats
    const isPem = content.includes('-----BEGIN') && content.includes('PRIVATE KEY-----')
    const isOpenSsh = content.includes('-----BEGIN OPENSSH PRIVATE KEY-----')

    if (!isPem && !isOpenSsh) {
      return {
        valid: false,
        error: 'File does not appear to contain a valid SSH private key (expected PEM or OpenSSH format)'
      }
    }

    // Check for encrypted keys (not supported without passphrase)
    if (content.includes('ENCRYPTED')) {
      return {
        valid: false,
        error: 'Encrypted SSH keys are not supported. Use an unencrypted key or remove the passphrase.'
      }
    }

    return { valid: true }
  } catch (error: any) {
    return {
      valid: false,
      error: `Failed to read SSH key file: ${error.message}`
    }
  }
}
