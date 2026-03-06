/**
 * POST /api/dns/windows/zones/:zoneId/records/audit-summaries
 * Get audit summaries (last changed info) for multiple records
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and, inArray, desc, sql } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { auditLogs, users, windowsDnsAllowedZones } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import type { AuditEventType } from '~~/server/utils/audit'

interface AuditSummary {
  lastChangedAt: string
  eventType: AuditEventType
  user: {
    id: string
    email: string | null
    fullName: string | null
  } | null
}

interface RequestBody {
  recordIds: string[]
}

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const zoneId = getRouterParam(event, 'zoneId')

  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'zoneId is required.' })
  }

  // Check module access
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view DNS records.' })
  }

  const db = getDb()

  // Verify zone is allowed for this organization
  const [allowedZone] = await db
    .select()
    .from(windowsDnsAllowedZones)
    .where(
      and(
        eq(windowsDnsAllowedZones.organizationId, orgId),
        eq(windowsDnsAllowedZones.zoneId, zoneId)
      )
    )
    .limit(1)

  if (!allowedZone) {
    throw createError({ statusCode: 404, message: 'Zone not found or not accessible.' })
  }

  const body = await readBody<RequestBody>(event)

  if (!body.recordIds || !Array.isArray(body.recordIds) || body.recordIds.length === 0) {
    return { summaries: {} }
  }

  // Limit batch size
  if (body.recordIds.length > 100) {
    throw createError({ statusCode: 400, message: 'Maximum 100 records can be queried at once.' })
  }

  // Event types to look for
  const recordEventTypes: AuditEventType[] = [
    'WINDOWS_DNS_RECORD_CREATED',
    'WINDOWS_DNS_RECORD_UPDATED',
    'WINDOWS_DNS_RECORD_DELETED'
  ]

  // Query audit logs for the given records
  // We need to find the most recent audit log for each entityId (recordId)
  // The entityId is stored in the meta JSON field
  const logs = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      userEmail: users.email,
      userFullName: users.fullName,
      eventType: auditLogs.eventType,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(
      and(
        eq(auditLogs.orgId, orgId),
        inArray(auditLogs.eventType, recordEventTypes)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(500) // Get recent logs, we'll filter in code

  // Build summaries map: recordId -> summary
  const summaries: Record<string, AuditSummary> = {}

  for (const log of logs) {
    if (!log.meta) continue

    try {
      const meta = JSON.parse(log.meta)
      const entityId = meta.entityId

      // Skip if not in the requested recordIds or already found
      if (!entityId || !body.recordIds.includes(entityId) || summaries[entityId]) {
        continue
      }

      // Also verify zoneId matches
      if (meta.zoneId && meta.zoneId !== zoneId) {
        continue
      }

      summaries[entityId] = {
        lastChangedAt: log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : String(log.createdAt),
        eventType: log.eventType as AuditEventType,
        user: log.userId
          ? {
            id: log.userId,
            email: log.userEmail,
            fullName: log.userFullName
          }
          : null
      }
    } catch {
      // Skip logs with invalid JSON meta
      continue
    }
  }

  return { summaries }
})
