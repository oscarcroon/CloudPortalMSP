import { H3Event, getRequestHeaders } from 'h3'
import { getClientIP } from './ip'
import { getDb } from './db'
import { auditLogs } from '../database/schema'
import { createId } from '@paralleldrive/cuid2'
import { ensureAuthState } from './session'

export type AuditEventType =
  | 'CONTEXT_SWITCH'
  | 'MFA_STEP_UP'
  | 'LOGIN'
  | 'LOGOUT'
  | 'TENANT_SETTINGS_UPDATED'
  | 'ORG_SETTINGS_UPDATED'
  | 'SSO_CONFIGURED'
  | 'SSO_REMOVED'
  | 'BILLING_UPDATED'
  | 'API_KEY_ROTATED'
  | 'API_KEY_CREATED'
  | 'API_KEY_DELETED'
  | 'USER_INVITED'
  | 'USER_REMOVED'
  | 'ROLE_CHANGED'
  | 'ORG_DELETED'
  | 'TENANT_DELETED'

export interface AuditLogMeta {
  [key: string]: any
}

/**
 * Log an audit event
 */
export const logAuditEvent = async (
  event: H3Event,
  eventType: AuditEventType,
  meta?: AuditLogMeta,
  fromContext?: { organizationId?: string | null; tenantId?: string | null },
  toContext?: { organizationId?: string | null; tenantId?: string | null }
) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    // Don't log if not authenticated
    return
  }

  const db = getDb()
  const ip = getClientIP(event)
  const headers = getRequestHeaders(event)
  const userAgent = headers['user-agent'] || ''

  await db.insert(auditLogs).values({
    id: createId(),
    userId: auth.user.id,
    eventType,
    fromContext: fromContext ? JSON.stringify(fromContext) : null,
    toContext: toContext ? JSON.stringify(toContext) : null,
    ip: ip || undefined,
    userAgent: userAgent || undefined,
    meta: meta ? JSON.stringify(meta) : undefined
  })
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

