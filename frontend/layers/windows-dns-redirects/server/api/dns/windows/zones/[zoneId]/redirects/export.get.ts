/**
 * GET /api/dns/windows/zones/:zoneId/redirects/export
 * Export redirects as CSV
 */
import { createError, defineEventHandler, getRouterParam, getQuery, setHeader } from 'h3'
import { eq, and, like } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirects, windowsDnsAllowedZones } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'

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

  // Check module access and export permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canExportRedirects) {
    throw createError({ statusCode: 403, message: 'No permission to export redirects.' })
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

  // Parse query parameters for filtering
  const query = getQuery(event)
  const format = (query.format as string) || 'csv'
  const search = (query.search as string) || ''
  const type = query.type as string | undefined
  const statusCode = query.statusCode ? parseInt(query.statusCode as string) : undefined
  const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined

  // Build conditions
  const conditions = [
    eq(windowsDnsRedirects.organizationId, orgId),
    eq(windowsDnsRedirects.zoneId, zoneId)
  ]

  if (search) {
    conditions.push(like(windowsDnsRedirects.sourcePath, `%${search}%`))
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

  // Get all matching redirects
  const redirects = await db
    .select()
    .from(windowsDnsRedirects)
    .where(and(...conditions))

  if (format === 'json') {
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="${allowedZone.zoneName}-redirects.json"`)

    return redirects.map(r => ({
      sourcePath: r.sourcePath,
      destinationUrl: r.destinationUrl,
      redirectType: r.redirectType,
      statusCode: r.statusCode,
      isActive: r.isActive,
      hitCount: r.hitCount,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt
    }))
  }

  // CSV format
  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="${allowedZone.zoneName}-redirects.csv"`)

  // CSV header
  const headers = ['sourcePath', 'destinationUrl', 'redirectType', 'statusCode', 'isActive', 'hitCount', 'createdAt']
  const csvLines = [headers.join(',')]

  // CSV rows
  for (const redirect of redirects) {
    const row = [
      escapeCSV(redirect.sourcePath),
      escapeCSV(redirect.destinationUrl),
      redirect.redirectType,
      String(redirect.statusCode),
      redirect.isActive ? 'true' : 'false',
      String(redirect.hitCount || 0),
      redirect.createdAt?.toISOString?.() || redirect.createdAt || ''
    ]
    csvLines.push(row.join(','))
  }

  return csvLines.join('\n')
})

function escapeCSV(value: string): string {
  if (!value) return ''
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
