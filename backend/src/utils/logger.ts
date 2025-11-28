import type { Request, Response } from 'express'
import { createId } from '@paralleldrive/cuid2'

export type LogLevel = 'info' | 'warn' | 'error' | 'security'

export interface LogContext {
  requestId?: string
  userId?: string
  orgId?: string
  endpoint?: string
  method?: string
  ip?: string
  userAgent?: string
  [key: string]: any
}

/**
 * Get request ID from request headers or generate new one
 */
export const getRequestId = (req: Request): string => {
  // Check header
  const headerId = req.headers['x-request-id'] as string | undefined
  if (headerId) {
    return headerId
  }
  
  // Generate new ID and store in request
  const newId = createId()
  ;(req as any).requestId = newId
  return newId
}

/**
 * Get client IP from request
 */
const getClientIP = (req: Request): string | undefined => {
  const xForwardedFor = req.headers['x-forwarded-for']
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor
    return ips.split(',')[0].trim()
  }
  
  const xRealIp = req.headers['x-real-ip']
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp
  }
  
  return req.socket?.remoteAddress || undefined
}

/**
 * Build log context from request
 */
const buildLogContext = (req: Request, res?: Response, extra?: Record<string, any>): LogContext => {
  const requestId = getRequestId(req)
  const method = req.method
  const path = req.path || req.url
  const ip = getClientIP(req)
  const userAgent = req.headers['user-agent'] || undefined
  
  const context: LogContext = {
    requestId,
    endpoint: path,
    method,
    ip,
    userAgent,
    ...extra
  }
  
  // Add user context if available
  if ((req as any).userContext) {
    const userContext = (req as any).userContext
    context.userId = userContext.id
    context.orgId = userContext.activeOrganisationId || undefined
  }
  
  // Add response status if available
  if (res) {
    context.statusCode = res.statusCode
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
  
  if (context.statusCode) {
    parts.push(`[${context.statusCode}]`)
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
export const logInfo = (
  req: Request,
  message: string,
  extra?: Record<string, any>,
  res?: Response
) => {
  const context = buildLogContext(req, res, extra)
  const jsonLog = formatLogEntry('info', message, context)
  const humanLog = formatHumanReadable('info', message, context)
  
  console.log(humanLog)
  if (process.env.NODE_ENV === 'production') {
    console.log(jsonLog)
  }
}

/**
 * Log warning message
 */
export const logWarn = (
  req: Request,
  message: string,
  extra?: Record<string, any>,
  res?: Response
) => {
  const context = buildLogContext(req, res, extra)
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
export const logError = (
  req: Request,
  message: string,
  error?: Error,
  extra?: Record<string, any>,
  res?: Response
) => {
  const context = buildLogContext(req, res, extra)
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
export const logSecurity = (
  req: Request,
  message: string,
  extra?: Record<string, any>,
  res?: Response
) => {
  const context = buildLogContext(req, res, extra)
  const jsonLog = formatLogEntry('security', message, context)
  const humanLog = formatHumanReadable('security', message, context)
  
  console.warn(`[SECURITY] ${humanLog}`)
  if (process.env.NODE_ENV === 'production') {
    console.warn(jsonLog)
  }
}

