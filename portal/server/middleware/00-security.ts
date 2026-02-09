/**
 * Security middleware - blocks common attack patterns early.
 *
 * Runs first (00- prefix) to reject malicious requests before any processing.
 * Returns 400 Bad Request for:
 * - Path traversal attempts (../, %2e%2e, etc.)
 * - Sensitive file access (.env, .aws, .git, etc.)
 * - System file access (/proc/, /etc/passwd, etc.)
 *
 * Also includes rate limiting for repeat offenders.
 */

import { defineEventHandler, createError, getRequestURL } from 'h3'
import { recordSecurityViolation, isSecurityBlocked, getSecurityBlockRemaining } from '../utils/rateLimit'
import { getClientIP } from '../utils/ip'

// Patterns that indicate path traversal attempts
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[\/\\]/,           // ../  or  ..\
  /%2e%2e[%2f%5c]/i,      // URL-encoded ../ or ..\
  /%252e%252e/i,          // Double-encoded ..
  /\.%2e|%2e\./i,         // Mixed encoding
]

// Sensitive file patterns to block
const SENSITIVE_FILE_PATTERNS = [
  /\.env($|\.)/i,                    // .env, .env.local, .env.production
  /\.aws\//i,                        // AWS credentials
  /\.git\//i,                        // Git directory
  /\.ssh\//i,                        // SSH keys
  /\.docker\//i,                     // Docker config
  /\.kube\//i,                       // Kubernetes config
  /\.npmrc$/i,                       // NPM config
  /\.netrc$/i,                       // Network credentials
  /credentials\.json$/i,             // Generic credentials
  /secrets?\.(json|ya?ml|txt)$/i,    // Secret files
  /config\.(json|ya?ml)$/i,          // Config files (if accessed directly)
  /\.pem$/i,                         // Private keys
  /\.key$/i,                         // Private keys
  /id_rsa/i,                         // SSH private keys
  /id_ed25519/i,                     // SSH private keys
]

// System paths to block (Linux/Unix)
const SYSTEM_PATH_PATTERNS = [
  /^\/proc\//,                       // Linux proc filesystem
  /^\/etc\/passwd/,                  // Unix password file
  /^\/etc\/shadow/,                  // Unix shadow file
  /^\/etc\/hosts/,                   // Hosts file
  /^\/root\//,                       // Root home directory
  /^\/home\/[^/]+\/\./,              // Hidden files in home dirs
  /^\/@fs\//,                        // Vite internal FS access
]

// Combine all patterns for efficient checking
const isBlockedPath = (path: string, decodedPath: string): boolean => {
  // Check path traversal
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(path) || pattern.test(decodedPath)) {
      return true
    }
  }

  // Check sensitive files
  for (const pattern of SENSITIVE_FILE_PATTERNS) {
    if (pattern.test(path) || pattern.test(decodedPath)) {
      return true
    }
  }

  // Check system paths
  for (const pattern of SYSTEM_PATH_PATTERNS) {
    if (pattern.test(decodedPath)) {
      return true
    }
  }

  return false
}

export default defineEventHandler((event) => {
  const clientIP = getClientIP(event) || 'unknown'

  // Check if IP is already blocked from previous violations
  if (isSecurityBlocked(clientIP)) {
    const remaining = getSecurityBlockRemaining(clientIP)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: `Temporarily blocked. Try again in ${remaining} seconds.`
    })
  }

  const url = getRequestURL(event)
  const path = url.pathname

  // Decode path for checking (attackers often URL-encode)
  let decodedPath: string
  try {
    // Double-decode to catch double-encoding attacks
    decodedPath = decodeURIComponent(decodeURIComponent(path))
  } catch {
    // If decoding fails, use original path
    decodedPath = path
  }

  if (isBlockedPath(path, decodedPath)) {
    // Record violation and check if should escalate to block
    const shouldBlock = recordSecurityViolation(clientIP)

    // Log the blocked request (minimal info to avoid log injection)
    const logPath = path.slice(0, 100).replace(/[\r\n]/g, '') // Prevent log injection
    console.warn(`[SECURITY] Blocked suspicious request: ${logPath} from ${clientIP}${shouldBlock ? ' (now blocked)' : ''}`)

    // Return 400 Bad Request - don't reveal why it was blocked
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid request'
    })
  }
})
