import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { 
  getOrgConfig,
  getOrgCoreId, 
  getAllowedZoneIds,
  getBlockedZoneIds,
  getLastDiscovery
} from '@windows-dns/server/lib/windows-dns/org-config'

/**
 * GET /api/dns/windows/zones/manage
 * 
 * Returns zone management data for admins:
 * - All discovered zones (from last autodiscover or fresh run)
 * - Which zones are allowed (active)
 * - Which zones are blocked (hidden)
 * 
 * Requires: canAutodiscover && canManageOwnership
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  // Require admin-level permissions
  if (!moduleRights.canAutodiscover || !moduleRights.canManageOwnership) {
    throw createError({ statusCode: 403, message: 'No permission to manage zones.' })
  }

  // Get CoreID from organizations.core_id (source of truth)
  const coreId = await getOrgCoreId(orgId)
  if (!coreId) {
    throw createError({
      statusCode: 400,
      message: 'DNS is not configured for this organization. Please set COREID first.'
    })
  }

  const config = await getOrgConfig(orgId)
  if (!config?.windowsDnsAccountId) {
    throw createError({
      statusCode: 400,
      message: 'DNS account not configured. Please enable DNS first.'
    })
  }

  // Run fresh autodiscover to get current zone state
  const client = await getClientForOrg(orgId)
  const discoveredZones = await client.autodiscoverZones()

  // Get current allowed and blocked lists
  const [allowedZoneIds, blockedZoneIds, lastDiscovery] = await Promise.all([
    getAllowedZoneIds(orgId),
    getBlockedZoneIds(orgId),
    getLastDiscovery(orgId)
  ])

  const allowedSet = new Set(allowedZoneIds)
  const blockedSet = new Set(blockedZoneIds)

  // Categorize zones
  const zonesWithStatus = discoveredZones.map(zone => ({
    ...zone,
    status: blockedSet.has(zone.id) 
      ? 'blocked' as const
      : allowedSet.has(zone.id) 
        ? 'allowed' as const 
        : 'available' as const
  }))

  return {
    zones: zonesWithStatus,
    allowedZoneIds,
    blockedZoneIds,
    lastDiscovery: lastDiscovery ? {
      discoveredAt: lastDiscovery.discoveredAt,
      zonesCount: lastDiscovery.zoneIds.length
    } : null,
    coreId: coreId.startsWith('coreid:') ? coreId.slice(7) : coreId
  }
})

