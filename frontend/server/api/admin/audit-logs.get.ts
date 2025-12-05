import { defineEventHandler, getQuery } from 'h3'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { auditLogs, users, organizations, tenants } from '../../database/schema'
import { getDb } from '../../utils/db'
import { requireSuperAdmin } from '../../utils/rbac'
import { validatePagination } from '../../utils/validation'
import type { AuditEventType } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  
  const query = getQuery(event)
  const db = getDb()
  
  // Parse filters
  const userId = query.userId as string | undefined
  const orgId = query.orgId as string | undefined
  const tenantId = query.tenantId as string | undefined
  const eventType = query.eventType as AuditEventType | undefined
  const severityRaw = query.severity as string | undefined
  const allowedSeverities = new Set(['error', 'critical', 'warning', 'info'] as const)
  const severity = allowedSeverities.has(severityRaw as any)
    ? (severityRaw as (typeof allowedSeverities extends Set<infer T> ? T : never))
    : undefined
  const startDate = query.startDate ? new Date(query.startDate as string) : undefined
  const endDate = query.endDate ? new Date(query.endDate as string) : undefined
  
  // Pagination
  const { page, pageSize, offset } = validatePagination({
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    maxPageSize: 100
  })
  
  // Build where conditions
  const conditions = []
  
  if (userId) {
    conditions.push(eq(auditLogs.userId, userId))
  }
  
  if (orgId) {
    conditions.push(eq(auditLogs.orgId, orgId))
  }
  
  if (tenantId) {
    conditions.push(eq(auditLogs.tenantId, tenantId))
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
  
  const whereClause =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]!
        : and(...conditions)
  
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(whereClause)
  
  const total = countResult?.count || 0
  
  // Get logs with user info
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
      orgName: organizations.name,
      tenantId: auditLogs.tenantId,
      tenantName: tenants.name,
      ip: auditLogs.ip,
      userAgent: auditLogs.userAgent,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .leftJoin(organizations, eq(organizations.id, auditLogs.orgId))
    .leftJoin(tenants, eq(tenants.id, auditLogs.tenantId))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset)
  
  // Parse meta JSON
  const logsWithParsedMeta = logs.map(log => ({
    ...log,
    meta: log.meta ? JSON.parse(log.meta) : null
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

