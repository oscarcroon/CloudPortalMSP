/**
 * POST /api/dns/windows/zones/:zoneId/redirects/bulk-toggle
 * Toggle active state for multiple redirects
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and, inArray } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirects, windowsDnsAllowedZones } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { logAuditEvent } from '~~/server/utils/audit'

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

  // Check module access and edit permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canEditRedirects) {
    throw createError({ statusCode: 403, message: 'No permission to edit redirects.' })
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

  const body = await readBody<{ ids: string[]; isActive: boolean }>(event)

  if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    throw createError({ statusCode: 400, message: 'ids array is required.' })
  }

  if (typeof body.isActive !== 'boolean') {
    throw createError({ statusCode: 400, message: 'isActive boolean is required.' })
  }

  // Limit bulk toggle to 100 items at a time
  if (body.ids.length > 100) {
    throw createError({ statusCode: 400, message: 'Maximum 100 redirects can be toggled at once.' })
  }

  // Verify all redirects exist and belong to this org/zone
  const existing = await db
    .select({ id: windowsDnsRedirects.id })
    .from(windowsDnsRedirects)
    .where(
      and(
        inArray(windowsDnsRedirects.id, body.ids),
        eq(windowsDnsRedirects.organizationId, orgId),
        eq(windowsDnsRedirects.zoneId, zoneId)
      )
    )

  const existingIds = existing.map(r => r.id)
  const notFoundIds = body.ids.filter(id => !existingIds.includes(id))

  if (notFoundIds.length > 0) {
    throw createError({
      statusCode: 404,
      message: `Some redirects not found: ${notFoundIds.join(', ')}`
    })
  }

  // Update the redirects
  await db
    .update(windowsDnsRedirects)
    .set({
      isActive: body.isActive,
      updatedAt: new Date()
    })
    .where(inArray(windowsDnsRedirects.id, body.ids))

  // Log audit event for bulk toggle
  await logAuditEvent(event, 'WINDOWS_DNS_REDIRECTS_BULK_TOGGLED', {
    moduleKey: 'windows-dns-redirects',
    entityType: 'windows_dns_redirect',
    zoneId,
    updatedCount: body.ids.length,
    updatedIds: body.ids,
    isActive: body.isActive
  })

  return {
    success: true,
    updatedCount: body.ids.length,
    updatedIds: body.ids,
    isActive: body.isActive
  }
})
