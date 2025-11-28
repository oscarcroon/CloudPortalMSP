import type { H3Event } from 'h3'
import { getRequestURL, getRequestHeader } from 'h3'
import { createId } from '@paralleldrive/cuid2'
import { getClientIP } from './ip'
import { ensureAuthState } from './session'

export type LogLevel = 'info' | 'warn' | 'error' | 'security'

export interface LogContext {
  requestId?: string
  userId?: string
  orgId?: string
  tenantId?: string
  endpoint?: string
  method?: string
  ip?: string | null
  userAgent?: string
  [key: string]: any
}

/**
 * Get request ID from event context or header
 */
export const getRequestId = (event: H3Event): string => {
  // Check if already set in context
  if (event.context.requestId) {
    return event.context.requestId as string
  }
  
  // Check header
  const headerId = getRequestHeader(event, 'x-request-id')
  if (headerId) {
    event.context.requestId = headerId
    return headerId
  }
  
  // Generate new ID
  const newId = createId()
  event.context.requestId = newId
  return newId
}

/**
 * Build log context from event
 */
const buildLogContext = async (event: H3Event, extra?: Record<string, any>): Promise<LogContext> => {
  const requestId = getRequestId(event)
  const url = getRequestURL(event)
  const method = event.node.req.method
  const ip = getClientIP(event)
  const userAgent = getRequestHeader(event, 'user-agent') || undefined
  
  const context: LogContext = {
    requestId,
    endpoint: url.pathname,
    method,
    ip,
    userAgent,
    ...extra
  }
  
  // Try to get auth state (but don't fail if not authenticated)
  try {
    const auth = await ensureAuthState(event)
    if (auth) {
      context.userId = auth.user.id
      context.orgId = auth.currentOrgId || undefined
      context.tenantId = auth.currentTenantId || undefined
    }
  } catch {
    // Not authenticated, skip auth context
  }
  
  return context
}

/**
 * Format log entry as JSON
 */
const formatLogEntry = (
  level: LogLevel,
  message: string,
  context: LogContext,
  error?: Error
): string => {
  const entry: any = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  }
  
  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }
  
  return JSON.stringify(entry)
}

/**
 * Format log entry as human-readable string
 */
const formatHumanReadable = (
  level: LogLevel,
  message: string,
  context: LogContext,
  error?: Error
): string => {
  const timestamp = new Date().toISOString()
  const parts = [
    `[${timestamp}]`,
    `[${level.toUpperCase()}]`,
    message
  ]
  
  if (context.requestId) {
    parts.push(`[req:${context.requestId}]`)
  }
  
  if (context.userId) {
    parts.push(`[user:${context.userId}]`)
  }
  
  if (context.endpoint) {
    parts.push(`[${context.method} ${context.endpoint}]`)
  }
  
  if (error) {
    parts.push(`\nError: ${error.message}`)
    if (error.stack) {
      parts.push(`\n${error.stack}`)
    }
  }
  
  return parts.join(' ')
}

/**
 * Log info message
 */
export const logInfo = async (
  event: H3Event,
  message: string,
  extra?: Record<string, any>
) => {
  const context = await buildLogContext(event, extra)
  const jsonLog = formatLogEntry('info', message, context)
  const humanLog = formatHumanReadable('info', message, context)
  
  console.log(humanLog)
  // In production, you might want to send JSON to a log aggregation service
  if (process.env.NODE_ENV === 'production') {
    console.log(jsonLog)
  }
}

/**
 * Log warning message
 */
export const logWarn = async (
  event: H3Event,
  message: string,
  extra?: Record<string, any>
) => {
  const context = await buildLogContext(event, extra)
  const jsonLog = formatLogEntry('warn', message, context)
  const humanLog = formatHumanReadable('warn', message, context)
  
  console.warn(humanLog)
  if (process.env.NODE_ENV === 'production') {
    console.warn(jsonLog)
  }
}

/**
 * Log error message
 */
export const logError = async (
  event: H3Event,
  message: string,
  error?: Error,
  extra?: Record<string, any>
) => {
  const context = await buildLogContext(event, extra)
  const jsonLog = formatLogEntry('error', message, context, error)
  const humanLog = formatHumanReadable('error', message, context, error)
  
  console.error(humanLog)
  if (process.env.NODE_ENV === 'production') {
    console.error(jsonLog)
  }
}

/**
 * Log security event
 */
export const logSecurity = async (
  event: H3Event,
  message: string,
  extra?: Record<string, any>
) => {
  const context = await buildLogContext(event, extra)
  const jsonLog = formatLogEntry('security', message, context)
  const humanLog = formatHumanReadable('security', message, context)
  
  console.warn(`[SECURITY] ${humanLog}`)
  if (process.env.NODE_ENV === 'production') {
    console.warn(jsonLog)
  }
}

