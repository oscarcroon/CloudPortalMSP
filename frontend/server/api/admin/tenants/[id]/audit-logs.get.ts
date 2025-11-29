import { createError, defineEventHandler, getRouterParam, getQuery } from 'h3'
import { eq, and, gte, lte, desc, sql, inArray, or } from 'drizzle-orm'
import { auditLogs, users, organizations, tenants } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireTenantPermission } from '../../../../utils/rbac'
import { validatePagination } from '../../../../utils/validation'
import type { AuditEventType } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }
  
  await requireTenantPermission(event, 'audit:read', tenantId)
  
  const query = getQuery(event)
  const db = getDb()
  
  // Parse filters
  const userId = query.userId as string | undefined
  const orgId = query.orgId as string | undefined
  const eventType = query.eventType as AuditEventType | undefined
  const severity = query.severity as string | undefined
  const startDate = query.startDate ? new Date(query.startDate as string) : undefined
  // Set endDate to end of day (23:59:59.999) to include the entire day
  const endDate = query.endDate ? (() => {
    const date = new Date(query.endDate as string)
    date.setHours(23, 59, 59, 999)
    return date
  })() : undefined
  
  // Pagination
  const { page, pageSize, offset } = validatePagination({
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    maxPageSize: 100
  })
  
  // Get all organizations under this tenant
  const orgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.tenantId, tenantId))
  
  const orgIds = orgs.map(org => org.id)
  
  // Build where conditions
  const conditions = []
  
  if (orgIds.length > 0) {
    // Logs for tenant or any of its organizations
    const tenantOrOrgs = or(
      eq(auditLogs.tenantId, tenantId),
      inArray(auditLogs.orgId, orgIds)
    )
    if (tenantOrOrgs) {
      conditions.push(tenantOrOrgs)
    }
  } else {
    // Only tenant logs if no organizations
    conditions.push(eq(auditLogs.tenantId, tenantId))
  }
  
  if (userId) {
    conditions.push(eq(auditLogs.userId, userId))
  }
  
  if (orgId) {
    conditions.push(eq(auditLogs.orgId, orgId))
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

