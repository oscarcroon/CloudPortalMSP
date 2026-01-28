import { H3Event, getRequestHeaders, getRequestURL } from 'h3'
import { getClientIP } from './ip'
import { getDb } from './db'
import { auditLogs } from '../database/schema'
import { createId } from '@paralleldrive/cuid2'
import { ensureAuthState } from './session'
import { getRequestId, logSecurity, logInfo, logWarn } from './logger'

/**
 * Core audit event types.
 * These are defined in core and provide TypeScript autocomplete.
 * 
 * Layer-specific events (e.g. WINDOWS_DNS_*, CLOUDFLARE_*) are NOT defined here.
 * Layers register their own event types via the audit registry.
 * The (string & {}) pattern allows any string value while preserving autocomplete.
 */
export type AuditEventType =
  // Authentication & Security
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_STEP_UP'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PERMISSION_DENIED'
  | 'SENSITIVE_DATA_ACCESSED'
  // User & Roles
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_INVITED'
  | 'INVITE_ACCEPTED'
  | 'INVITE_CANCELLED'
  | 'INVITE_EXPIRED'
  | 'USER_REMOVED'
  | 'ROLE_CHANGED'
  | 'STATUS_CHANGED'
  // Organizations
  | 'ORGANIZATION_CREATED'
  | 'ORGANIZATION_UPDATED'
  | 'ORGANIZATION_DELETED'
  | 'ORG_SETTINGS_UPDATED'
  | 'ORG_AUTH_SETTINGS_UPDATED'
  // Tenants / Distributors / Providers
  | 'TENANT_CREATED'
  | 'TENANT_UPDATED'
  | 'TENANT_DELETED'
  | 'TENANT_SETTINGS_UPDATED'
  | 'SSO_CONFIGURED'
  | 'SSO_UPDATED'
  | 'SSO_REMOVED'
  // Modules & Configuration
  | 'MODULE_ENABLED'
  | 'MODULE_DISABLED'
  | 'EMAIL_PROVIDER_CONFIGURED'
  | 'EMAIL_PROVIDER_UPDATED'
  | 'API_TOKEN_CREATED'
  | 'API_TOKEN_REVOKED'
  | 'API_TOKEN_USED'
  | 'API_TOKEN_AUTH_FAILED'
  | 'API_KEY_ROTATED'
  | 'API_KEY_CREATED'
  | 'API_KEY_DELETED'
  // Context & Other
  | 'CONTEXT_SWITCH'
  | 'BILLING_UPDATED'
  // Layer events - allows any string for layer-defined events
  // This enables layers to define their own events without modifying core
  | (string & {})

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AuditLogMeta {
  [key: string]: any
}

export interface AuditLogOptions {
  eventType: AuditEventType
  severity?: AuditSeverity
  meta?: AuditLogMeta
  fromContext?: { organizationId?: string | null; tenantId?: string | null }
  toContext?: { organizationId?: string | null; tenantId?: string | null }
  userId?: string | null
  orgId?: string | null
  tenantId?: string | null
}

/**
 * Log an audit event
 * Can log events even when user is not authenticated (for security events like LOGIN_FAILED)
 */
export const logAuditEvent = async (
  event: H3Event,
  eventType: AuditEventType,
  meta?: AuditLogMeta,
  fromContext?: { organizationId?: string | null; tenantId?: string | null },
  toContext?: { organizationId?: string | null; tenantId?: string | null },
  options?: {
    severity?: AuditSeverity
    userId?: string | null
    orgId?: string | null
    tenantId?: string | null
  }
) => {
  const db = getDb()
  const ip = getClientIP(event)
  const headers = getRequestHeaders(event)
  const userAgent = headers['user-agent'] || ''
  const url = getRequestURL(event)
  const method = event.node.req.method
  const requestId = getRequestId(event)
  
  // Determine severity if not provided
  const severity = options?.severity || getDefaultSeverity(eventType)
  
  // Try to get auth state, but allow logging without it
  let userId: string | null = options?.userId ?? null
  let orgId: string | null = options?.orgId ?? null
  let tenantId: string | null = options?.tenantId ?? null
  
  if (!userId) {
    try {
      const auth = await ensureAuthState(event)
      if (auth) {
        userId = auth.user.id
        orgId = orgId || auth.currentOrgId || null
        tenantId = tenantId || auth.currentTenantId || null
      }
    } catch {
      // Not authenticated, continue with provided or null values
    }
  }
  
  // Sanitize metadata - remove sensitive information
  const sanitizedMeta = sanitizeMetadata(meta)
  
  // Insert into audit_logs table
  const isSqlite = (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'
  
  if (isSqlite) {
    db.insert(auditLogs).values({
      id: createId(),
      userId: userId || null,
      eventType,
      severity,
      requestId,
      endpoint: url.pathname,
      method,
      orgId: orgId || null,
      tenantId: tenantId || null,
      fromContext: fromContext ? JSON.stringify(fromContext) : null,
      toContext: toContext ? JSON.stringify(toContext) : null,
      ip: ip || undefined,
      userAgent: userAgent || undefined,
      meta: sanitizedMeta ? JSON.stringify(sanitizedMeta) : undefined
    }).run()
  } else {
    await db.insert(auditLogs).values({
      id: createId(),
      userId: userId || null,
      eventType,
      severity,
      requestId,
      endpoint: url.pathname,
      method,
      orgId: orgId || null,
      tenantId: tenantId || null,
      fromContext: fromContext ? JSON.stringify(fromContext) : null,
      toContext: toContext ? JSON.stringify(toContext) : null,
      ip: ip || undefined,
      userAgent: userAgent || undefined,
      meta: sanitizedMeta ? JSON.stringify(sanitizedMeta) : undefined
    })
  }
  
  // Also log to structured logger for correlation
  const logMessage = `Audit event: ${eventType}`
  const logContext = {
    eventType,
    severity,
    userId: userId || undefined,
    orgId: orgId || undefined,
    tenantId: tenantId || undefined
  }
  
  if (severity === 'critical' || severity === 'error') {
    await logSecurity(event, logMessage, { ...logContext, ...sanitizedMeta })
  } else if (severity === 'warning') {
    await logWarn(event, logMessage, { ...logContext, ...sanitizedMeta })
  } else {
    await logInfo(event, logMessage, { ...logContext, ...sanitizedMeta })
  }
}

/**
 * Get default severity for event type
 */
const getDefaultSeverity = (eventType: AuditEventType): AuditSeverity => {
  switch (eventType) {
    case 'LOGIN_FAILED':
    case 'RATE_LIMIT_EXCEEDED':
    case 'PERMISSION_DENIED':
      return 'warning'
    case 'USER_DELETED':
    case 'ORGANIZATION_DELETED':
    case 'TENANT_DELETED':
    case 'API_TOKEN_REVOKED':
    case 'INVITE_CANCELLED':
      return 'warning'
    case 'SENSITIVE_DATA_ACCESSED':
      return 'info'
    default:
      return 'info'
  }
}

/**
 * Sanitize metadata to remove sensitive information
 */
const sanitizeMetadata = (meta?: AuditLogMeta): AuditLogMeta | undefined => {
  if (!meta) return undefined
  
  const sanitized: AuditLogMeta = { ...meta }
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'api_key', 'accessToken', 'refreshToken']
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]'
    }
  }
  
  return sanitized
}

/**
 * Log context switch event
 */
export const logContextSwitch = async (
  event: H3Event,
  fromContext: { organizationId?: string | null; tenantId?: string | null },
  toContext: { organizationId?: string | null; tenantId?: string | null },
  withMfa: boolean = false
) => {
  await logAuditEvent(event, 'CONTEXT_SWITCH', { withMfa }, fromContext, toContext)
}

/**
 * Log MFA step-up event
 */
export const logMfaStepUp = async (
  event: H3Event,
  scope: string,
  success: boolean
) => {
  await logAuditEvent(event, 'MFA_STEP_UP', { scope, success })
}

/**
 * Log sensitive action
 */
export const logSensitiveAction = async (
  event: H3Event,
  actionType: AuditEventType,
  meta?: AuditLogMeta
) => {
  await logAuditEvent(event, actionType, meta)
}

/**
 * Log security event (failed logins, permission denials, etc.)
 */
export const logSecurityEvent = async (
  event: H3Event,
  eventType: AuditEventType,
  meta?: AuditLogMeta,
  options?: {
    userId?: string | null
    orgId?: string | null
    tenantId?: string | null
  }
) => {
  const severity = getDefaultSeverity(eventType)
  await logAuditEvent(event, eventType, meta, undefined, undefined, {
    severity,
    ...options
  })
}

/**
 * Log user-related action
 */
export const logUserAction = async (
  event: H3Event,
  eventType: AuditEventType,
  meta?: AuditLogMeta,
  targetUserId?: string
) => {
  await logAuditEvent(event, eventType, { ...meta, targetUserId })
}

/**
 * Log organization-related action
 */
export const logOrganizationAction = async (
  event: H3Event,
  eventType: AuditEventType,
  meta?: AuditLogMeta,
  orgId?: string
) => {
  await logAuditEvent(event, eventType, meta, undefined, undefined, {
    orgId: orgId || undefined
  })
}

/**
 * Log tenant-related action
 */
export const logTenantAction = async (
  event: H3Event,
  eventType: AuditEventType,
  meta?: AuditLogMeta,
  tenantId?: string
) => {
  await logAuditEvent(event, eventType, meta, undefined, undefined, {
    tenantId: tenantId || undefined,
    orgId: null // Explicitly set orgId to null for tenant actions to avoid confusion
  })
}

/**
 * Log permission denied event
 */
export const logPermissionDenied = async (
  event: H3Event,
  permission: string,
  reason: string,
  orgId?: string,
  tenantId?: string
) => {
  await logAuditEvent(
    event,
    'PERMISSION_DENIED',
    { permission, reason },
    undefined,
    undefined,
    {
      severity: 'warning',
      orgId,
      tenantId
    }
  )
}

