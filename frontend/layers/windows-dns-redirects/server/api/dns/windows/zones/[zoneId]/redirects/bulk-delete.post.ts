/**
 * POST /api/dns/windows/zones/:zoneId/redirects/bulk-delete
 * Delete multiple redirects at once
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and, inArray } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirects, windowsDnsAllowedZones, windowsDnsRedirectHits } from '~~/server/database/schema'
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

  // Check module access and delete permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canDeleteRedirects) {
    throw createError({ statusCode: 403, message: 'No permission to delete redirects.' })
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

  const body = await readBody<{ ids: string[] }>(event)

  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    throw createError({ statusCode: 400, message: 'ids array is required.' })
  }

  // Limit bulk delete to 100 items at a time
  if (body.ids.length > 100) {
    throw createError({ statusCode: 400, message: 'Maximum 100 redirects can be deleted at once.' })
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

  // Delete associated hits first
  await db
    .delete(windowsDnsRedirectHits)
    .where(inArray(windowsDnsRedirectHits.redirectId, body.ids))

  // Delete the redirects
  await db
    .delete(windowsDnsRedirects)
    .where(inArray(windowsDnsRedirects.id, body.ids))

  return {
    success: true,
    deletedCount: body.ids.length,
    deletedIds: body.ids
  }
})
