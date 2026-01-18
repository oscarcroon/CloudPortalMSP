/**
 * DELETE /api/dns/windows/zones/:zoneId/redirects/:redirectId
 * Delete a redirect
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
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
  const redirectId = getRouterParam(event, 'redirectId')

  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'zoneId is required.' })
  }

  if (!redirectId) {
    throw createError({ statusCode: 400, message: 'redirectId is required.' })
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

  // Get existing redirect
  const [existing] = await db
    .select()
    .from(windowsDnsRedirects)
    .where(
      and(
        eq(windowsDnsRedirects.id, redirectId),
        eq(windowsDnsRedirects.organizationId, orgId),
        eq(windowsDnsRedirects.zoneId, zoneId)
      )
    )
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Redirect not found.' })
  }

  // Delete associated hits first (cascade should handle this but being explicit)
  await db
    .delete(windowsDnsRedirectHits)
    .where(eq(windowsDnsRedirectHits.redirectId, redirectId))

  // Delete the redirect
  await db
    .delete(windowsDnsRedirects)
    .where(eq(windowsDnsRedirects.id, redirectId))

  return {
    success: true,
    deletedId: redirectId,
    sourcePath: existing.sourcePath
  }
})
