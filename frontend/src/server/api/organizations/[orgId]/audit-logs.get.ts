import { defineEventHandler, getRouterParam, getQuery } from 'h3'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { auditLogs, users } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { requirePermission } from '../../../utils/rbac'
import { validatePagination } from '../../../utils/validation'
import type { AuditEventType } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }
  
  await requirePermission(event, 'audit:read', orgId)
  
  const query = getQuery(event)
  const db = getDb()
  
  // Parse filters
  const userId = query.userId as string | undefined
  const eventType = query.eventType as AuditEventType | undefined
  const severity = query.severity as string | undefined
  const startDate = query.startDate ? new Date(query.startDate as string) : undefined
  const endDate = query.endDate ? new Date(query.endDate as string) : undefined
  
  // Pagination
  const { page, pageSize, offset } = validatePagination({
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    maxPageSize: 100
  })
  
  // Build where conditions - only show logs for this organization
  const conditions = [eq(auditLogs.orgId, orgId)]
  
  if (userId) {
    conditions.push(eq(auditLogs.userId, userId))
  }
  
  if (eventType) {
    conditions.push(eq(auditLogs.eventType, eventType))
  }
  
  if (severity) {
    conditions.push(eq(auditLogs.severity, severity))
  }
  
  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate))
  }
  
  if (endDate) {
    conditions.push(lte(auditLogs.createdAt, endDate))
  }
  
  const whereClause = and(...conditions)
  
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(whereClause)
  
  const total = countResult?.count || 0
  
  // Get logs with user info
  // Only show relevant event types for org admins (not all security events)
  const relevantEventTypes: AuditEventType[] = [
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'ROLE_CHANGED',
    'USER_INVITED',
    'USER_REMOVED',
    'MODULE_ENABLED',
    'MODULE_DISABLED',
    'SENSITIVE_DATA_ACCESSED',
    'ORGANIZATION_UPDATED',
    'ORG_SETTINGS_UPDATED',
    'ORG_AUTH_SETTINGS_UPDATED'
  ]
  
  const logs = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      userEmail: users.email,
      userName: users.fullName,
      eventType: auditLogs.eventType,
      severity: auditLogs.severity,
      requestId: auditLogs.requestId,
      endpoint: auditLogs.endpoint,
      method: auditLogs.method,
      orgId: auditLogs.orgId,
      ip: auditLogs.ip,
      userAgent: auditLogs.userAgent,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset)
  
  // Filter to only show relevant event types and mask IP for privacy
  const logsWithParsedMeta = logs
    .filter(log => relevantEventTypes.includes(log.eventType as AuditEventType))
    .map(log => ({
      ...log,
      meta: log.meta ? JSON.parse(log.meta) : null,
      // Mask IP address (show only first 3 octets)
      ip: log.ip ? log.ip.split('.').slice(0, 3).join('.') + '.xxx' : null
    }))
  
  return {
    logs: logsWithParsedMeta,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  }
})

