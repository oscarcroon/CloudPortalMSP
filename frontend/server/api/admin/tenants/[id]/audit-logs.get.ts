import { createError, defineEventHandler, getRouterParam, getQuery } from 'h3'
import { eq, and, gte, lte, desc, sql, inArray, or, isNull } from 'drizzle-orm'
import { auditLogs, users, organizations, tenants } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireTenantPermission } from '../../../../utils/rbac'
import { validatePagination } from '../../../../utils/validation'
import type { AuditEventType } from '../../../../utils/audit'
import { getTenantAuditScope } from '../../../../utils/auditScope'
import {
  auditContextScopeSchema,
  DEFAULT_AUDIT_CONTEXT_SCOPE,
  type AuditContextScope
} from '../../../../validation/audit'

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
  
  const requestedScope = query.contextScope as string | undefined
  let parsedScope: AuditContextScope = DEFAULT_AUDIT_CONTEXT_SCOPE
  if (requestedScope) {
    try {
      parsedScope = auditContextScopeSchema.parse(requestedScope)
    } catch {
      throw createError({
        statusCode: 400,
        message: 'Invalid context scope'
      })
    }
  }
  
  const scopeData = await getTenantAuditScope(tenantId)
  const contextScope = normalizeContextScope(parsedScope, scopeData.tenantType)
  
  const scopeCondition = buildScopeCondition(contextScope, scopeData)
  const conditions = [scopeCondition]
  
  if (userId) {
    conditions.push(eq(auditLogs.userId, userId))
  }
  
  if (orgId) {
    if (!scopeData.orgIds.includes(orgId)) {
      throw createError({
        statusCode: 403,
        message: 'Organization is outside the current tenant scope'
      })
    }
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
  
  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)
  
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
  
  const logsWithParsedMeta = logs.map(log => ({
    ...log,
    meta: log.meta ? JSON.parse(log.meta) : null,
    ip: maskIp(log.ip)
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

const maskIp = (ip: string | null) => {
  if (!ip) return null
  const segments = ip.split('.')
  if (segments.length !== 4) {
    return ip
  }
  segments[3] = 'xxx'
  return segments.join('.')
}

const normalizeContextScope = (
  requested: AuditContextScope,
  tenantType: 'provider' | 'distributor' | 'organization'
): AuditContextScope => {
  if (requested === 'providers' && tenantType !== 'distributor') {
    return 'tenant'
  }
  return requested
}

const buildScopeCondition = (
  scope: AuditContextScope,
  data: Awaited<ReturnType<typeof getTenantAuditScope>>
) => {
  const noMatch = sql`1 = 0`
  const tenantCondition = inArray(auditLogs.tenantId, data.selfTenantIds)
  const selfTenantClause = and(tenantCondition, isNull(auditLogs.orgId))
  
  const providerClause =
    data.providerTenantIds.length > 0
      ? and(inArray(auditLogs.tenantId, data.providerTenantIds), isNull(auditLogs.orgId))
      : null
  
  const organizationClause =
    data.orgIds.length > 0 ? inArray(auditLogs.orgId, data.orgIds) : null
  
  switch (scope) {
    case 'tenant':
      return selfTenantClause
    case 'providers':
      return providerClause ?? noMatch
    case 'organizations':
      return organizationClause ?? noMatch
    case 'all':
    default: {
      const clauses = [selfTenantClause, providerClause, organizationClause].filter(Boolean)
      if (clauses.length === 0) {
        return noMatch
      }
      return clauses.slice(1).reduce((acc, clause) => or(acc, clause!), clauses[0]!)
    }
  }
}

