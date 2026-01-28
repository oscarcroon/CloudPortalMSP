/**
 * GET /api/dns/windows/redirects/zones
 * List available zones with redirect counts
 * Uses the same zone data from windows-dns layer
 */
import { createError, defineEventHandler } from 'h3'
import { eq, sql } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsAllowedZones, windowsDnsRedirects } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'

export default defineEventHandler(async (event) => {
  // Require authentication
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({
      statusCode: 400,
      message: 'Organization missing from session.'
    })
  }

  const orgId = auth.currentOrgId

  // Check permission
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canView) {
    throw createError({
      statusCode: 403,
      message: 'Access denied'
    })
  }

  const db = getDb()

  // Get allowed zones for this org
  const allowedZones = await db
    .select({
      zoneId: windowsDnsAllowedZones.zoneId,
      zoneName: windowsDnsAllowedZones.zoneName
    })
    .from(windowsDnsAllowedZones)
    .where(eq(windowsDnsAllowedZones.organizationId, orgId))

  // Get redirect counts per zone
  let redirectCounts: { zoneId: string; count: number }[] = []
  try {
    redirectCounts = await db
      .select({
        zoneId: windowsDnsRedirects.zoneId,
        count: sql<number>`count(*)`
      })
      .from(windowsDnsRedirects)
      .where(eq(windowsDnsRedirects.organizationId, orgId))
      .groupBy(windowsDnsRedirects.zoneId)
  } catch {
    // Table might not exist yet, ignore
  }

  // Create a map of zone ID to count
  const countMap = new Map(redirectCounts.map(r => [r.zoneId, Number(r.count) || 0]))

  // Build zones with counts
  const zones = allowedZones.map(zone => ({
    id: zone.zoneId,
    name: zone.zoneName,
    type: 'Primary',
    status: 'active',
    redirectCount: countMap.get(zone.zoneId) || 0
  }))

  return {
    zones,
    total: zones.length,
    source: 'api' as const,
    apiError: null
  }
})
