/**
 * GET /api/dns/windows/zones/:zoneId/redirects/stats
 * Get statistics for redirects in a zone
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq, and, sql, gte } from 'drizzle-orm'
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

  // Get basic counts
  const redirects = await db
    .select({
      id: windowsDnsRedirects.id,
      isActive: windowsDnsRedirects.isActive,
      redirectType: windowsDnsRedirects.redirectType,
      hitCount: windowsDnsRedirects.hitCount,
      sourcePath: windowsDnsRedirects.sourcePath,
      lastHitAt: windowsDnsRedirects.lastHitAt
    })
    .from(windowsDnsRedirects)
    .where(
      and(
        eq(windowsDnsRedirects.organizationId, orgId),
        eq(windowsDnsRedirects.zoneId, zoneId)
      )
    )

  const totalRedirects = redirects.length
  const activeRedirects = redirects.filter(r => r.isActive).length
  const inactiveRedirects = totalRedirects - activeRedirects
  const totalHits = redirects.reduce((sum, r) => sum + (r.hitCount || 0), 0)

  // Count by type
  const byType = {
    simple: redirects.filter(r => r.redirectType === 'simple').length,
    wildcard: redirects.filter(r => r.redirectType === 'wildcard').length,
    regex: redirects.filter(r => r.redirectType === 'regex').length
  }

  // Top redirects by hits
  const topRedirects = redirects
    .filter(r => r.hitCount > 0)
    .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
    .slice(0, 10)
    .map(r => ({
      id: r.id,
      sourcePath: r.sourcePath,
      hitCount: r.hitCount,
      lastHitAt: r.lastHitAt?.toISOString?.() || r.lastHitAt
    }))

  // Get hits over time (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]!

  // Get redirect IDs for this zone
  const redirectIds = redirects.map(r => r.id)

  let dailyHits: { date: string; count: number }[] = []

  if (redirectIds.length > 0) {
    const hitsData = await db
      .select({
        date: windowsDnsRedirectHits.hitDate,
        count: sql<number>`sum(${windowsDnsRedirectHits.hitCount})`
      })
      .from(windowsDnsRedirectHits)
      .where(
        and(
          sql`${windowsDnsRedirectHits.redirectId} IN (${sql.join(redirectIds.map(id => sql`${id}`), sql`, `)})`,
          gte(windowsDnsRedirectHits.hitDate, thirtyDaysAgoStr)
        )
      )
      .groupBy(windowsDnsRedirectHits.hitDate)
      .orderBy(windowsDnsRedirectHits.hitDate)

    dailyHits = hitsData.map(h => ({
      date: h.date,
      count: Number(h.count) || 0
    }))
  }

  // Calculate today's hits
  const today = new Date().toISOString().split('T')[0]
  const hitsToday = dailyHits.find(h => h.date === today)?.count || 0

  return {
    zone: {
      id: allowedZone.zoneId,
      name: allowedZone.zoneName
    },
    stats: {
      totalRedirects,
      activeRedirects,
      inactiveRedirects,
      totalHits,
      hitsToday,
      byType,
      topRedirects,
      dailyHits
    }
  }
})
