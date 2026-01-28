/**
 * POST /api/dns/windows/zones/:zoneId/redirects/import
 * Import redirects from CSV/TXT file
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirects, windowsDnsAllowedZones, windowsDnsRedirectImportLogs } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { normalizeRedirectHost } from '@windows-dns-redirects/server/utils/normalizeHost'
import type { WindowsDnsRedirectImportRow, WindowsDnsRedirectImportError } from '../../../../types'

interface ImportBody {
  rows: WindowsDnsRedirectImportRow[]
  skipDuplicates?: boolean
  filename?: string
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

  // Check module access and import permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canImportRedirects) {
    throw createError({ statusCode: 403, message: 'No permission to import redirects.' })
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

  const zoneName = allowedZone.zoneName || ''
  const body = await readBody<ImportBody>(event)

  if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
    throw createError({ statusCode: 400, message: 'rows array is required.' })
  }

  // Limit import to 1000 rows at a time
  if (body.rows.length > 1000) {
    throw createError({ statusCode: 400, message: 'Maximum 1000 redirects can be imported at once.' })
  }

  const skipDuplicates = body.skipDuplicates !== false

  // Get existing (host, sourcePath) pairs for duplicate detection
  const existingRedirects = await db
    .select({
      host: windowsDnsRedirects.host,
      sourcePath: windowsDnsRedirects.sourcePath
    })
    .from(windowsDnsRedirects)
    .where(
      and(
        eq(windowsDnsRedirects.organizationId, orgId),
        eq(windowsDnsRedirects.zoneId, zoneId)
      )
    )

  // Create a set of existing host|sourcePath combinations
  const existingKeys = new Set(existingRedirects.map(r => `${r.host || zoneName}|${r.sourcePath}`))

  const errors: WindowsDnsRedirectImportError[] = []
  const toInsert: any[] = []
  const validTypes = ['simple', 'wildcard', 'regex']
  const validStatusCodes = [301, 302, 307, 308]

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i]
    const rowNum = i + 1

    // Normalize host (defaults to zoneName if empty/undefined)
    let host: string
    try {
      host = normalizeRedirectHost(row.host, zoneName)
    } catch (e: any) {
      errors.push({ row: rowNum, field: 'host', message: e?.message || 'Invalid host', value: row.host })
      continue
    }

    // Validate sourcePath
    if (!row.sourcePath) {
      errors.push({ row: rowNum, field: 'sourcePath', message: 'Source path is required' })
      continue
    }

    if (!row.sourcePath.startsWith('/')) {
      errors.push({ row: rowNum, field: 'sourcePath', message: 'Source path must start with /', value: row.sourcePath })
      continue
    }

    // Validate destinationUrl
    if (!row.destinationUrl) {
      errors.push({ row: rowNum, field: 'destinationUrl', message: 'Destination URL is required' })
      continue
    }

    try {
      new URL(row.destinationUrl)
    } catch {
      errors.push({ row: rowNum, field: 'destinationUrl', message: 'Invalid URL format', value: row.destinationUrl })
      continue
    }

    // Validate redirect type
    const redirectType = row.redirectType || 'simple'
    if (!validTypes.includes(redirectType)) {
      errors.push({ row: rowNum, field: 'redirectType', message: 'Invalid redirect type', value: redirectType })
      continue
    }

    // Validate status code
    const statusCode = row.statusCode || 301
    if (!validStatusCodes.includes(statusCode)) {
      errors.push({ row: rowNum, field: 'statusCode', message: 'Invalid status code', value: String(statusCode) })
      continue
    }

    // Validate regex if needed
    if (redirectType === 'regex') {
      try {
        new RegExp(row.sourcePath)
      } catch {
        errors.push({ row: rowNum, field: 'sourcePath', message: 'Invalid regex pattern', value: row.sourcePath })
        continue
      }
    }

    // Check for duplicate based on (host, sourcePath)
    const key = `${host}|${row.sourcePath}`
    if (existingKeys.has(key)) {
      if (skipDuplicates) {
        continue // Silently skip
      } else {
        errors.push({ row: rowNum, field: 'sourcePath', message: `Duplicate redirect for host "${host}"`, value: row.sourcePath })
        continue
      }
    }

    // Check for duplicate in current import batch
    if (toInsert.some(r => r.host === host && r.sourcePath === row.sourcePath)) {
      errors.push({ row: rowNum, field: 'sourcePath', message: `Duplicate redirect in import for host "${host}"`, value: row.sourcePath })
      continue
    }

    // Add to insert list
    toInsert.push({
      organizationId: orgId,
      zoneId,
      zoneName,
      host,
      sourcePath: row.sourcePath,
      destinationUrl: row.destinationUrl,
      redirectType,
      statusCode,
      isActive: true,
      createdBy: auth.user.id
    })

    // Track in set to prevent duplicates within batch
    existingKeys.add(key)
  }

  // Insert valid redirects
  if (toInsert.length > 0) {
    await db.insert(windowsDnsRedirects).values(toInsert)
  }

  // Log the import
  await db.insert(windowsDnsRedirectImportLogs).values({
    organizationId: orgId,
    zoneId,
    filename: body.filename || 'import.csv',
    totalRows: body.rows.length,
    successfulRows: toInsert.length,
    failedRows: errors.length,
    errorDetails: errors.length > 0 ? JSON.stringify(errors) : null,
    importedBy: auth.user.id
  })

  return {
    success: true,
    totalRows: body.rows.length,
    successfulRows: toInsert.length,
    failedRows: errors.length,
    skippedDuplicates: body.rows.length - toInsert.length - errors.length,
    errors: errors.slice(0, 50) // Return first 50 errors
  }
})
