/**
 * GET /api/dns/windows/zones/:zoneId/redirects
 * List all redirects for a specific zone
 */
import { createError, defineEventHandler, getRouterParam, getQuery } from 'h3'
import { eq, and, like, sql, desc, asc } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirects, windowsDnsAllowedZones } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import type { WindowsDnsRedirectFilters, WindowsDnsRedirectSortField, WindowsDnsRedirectSortDirection } from '../../../../types'

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
    throw createError({ statusCode: 403, message: 'No permission to view redirects.' })
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

  // Parse query parameters
  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 20))
  const search = (query.search as string) || ''
  const type = query.type as string | undefined
  const statusCode = query.statusCode ? parseInt(query.statusCode as string) : undefined
  const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined
  const sortField = (query.sortField as WindowsDnsRedirectSortField) || 'createdAt'
  const sortDirection = (query.sortDirection as WindowsDnsRedirectSortDirection) || 'desc'

  // Build conditions
  const conditions = [
    eq(windowsDnsRedirects.organizationId, orgId),
    eq(windowsDnsRedirects.zoneId, zoneId)
  ]

  if (search) {
    conditions.push(
      like(windowsDnsRedirects.sourcePath, `%${search}%`)
    )
  }

  if (type && ['simple', 'wildcard', 'regex'].includes(type)) {
    conditions.push(eq(windowsDnsRedirects.redirectType, type as 'simple' | 'wildcard' | 'regex'))
  }

  if (statusCode && [301, 302, 307, 308].includes(statusCode)) {
    conditions.push(eq(windowsDnsRedirects.statusCode, statusCode))
  }

  if (isActive !== undefined) {
    conditions.push(eq(windowsDnsRedirects.isActive, isActive))
  }

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(windowsDnsRedirects)
    .where(and(...conditions))

  const total = countResult?.count || 0

  // Determine sort column
  const sortColumn = {
    createdAt: windowsDnsRedirects.createdAt,
    updatedAt: windowsDnsRedirects.updatedAt,
    hitCount: windowsDnsRedirects.hitCount,
    lastHitAt: windowsDnsRedirects.lastHitAt,
    sourcePath: windowsDnsRedirects.sourcePath
  }[sortField] || windowsDnsRedirects.createdAt

  const orderFn = sortDirection === 'asc' ? asc : desc

  // Get redirects with pagination
  const redirects = await db
    .select()
    .from(windowsDnsRedirects)
    .where(and(...conditions))
    .orderBy(orderFn(sortColumn))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    items: redirects.map(r => ({
      ...r,
      // Ensure dates are serialized properly
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt,
      lastHitAt: r.lastHitAt?.toISOString?.() || r.lastHitAt
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    zone: {
      id: allowedZone.zoneId,
      name: allowedZone.zoneName
    }
  }
})
