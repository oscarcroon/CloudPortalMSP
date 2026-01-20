import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import {
  getOrgConfig,
  getOrgCoreId,
  getLastDiscovery,
  validateZonesAgainstLastDiscovery,
  addAllowedZones,
  getAllowedZoneIds
} from '@windows-dns/server/lib/windows-dns/org-config'

/**
 * POST /api/dns/windows/autodiscover/activate
 * 
 * Activates zones from the last autodiscover result and adds them to the allowed list.
 * If no zoneIds are provided, all zones from the last discovery are activated.
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canManageOwnership) {
    throw createError({ statusCode: 403, message: 'No permission to activate zones.' })
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
      message: 'DNS account not configured. Please run autodiscover first.'
    })
  }

  // Get the last discovery result
  const lastDiscovery = await getLastDiscovery(orgId)
  if (!lastDiscovery) {
    throw createError({
      statusCode: 400,
      message: 'No autodiscover results found. Please run autodiscover first.'
    })
  }

  // Check if discovery was made with the current coreId
  if (lastDiscovery.coreIdSnapshot && lastDiscovery.coreIdSnapshot !== coreId) {
    throw createError({
      statusCode: 400,
      message: 'COREID has changed since last autodiscover. Please run autodiscover again.'
    })
  }

  const body = await readBody(event)

  // Determine which zones to activate
  let zoneIdsToActivate: string[]

  if (body?.zoneIds && Array.isArray(body.zoneIds) && body.zoneIds.length > 0) {
    // Validate that provided zoneIds are from the last discovery
    const validation = await validateZonesAgainstLastDiscovery(orgId, body.zoneIds)
    if (!validation.valid) {
      throw createError({
        statusCode: 400,
        message: `Some zones were not found in the last autodiscover result: ${validation.invalidZoneIds.join(', ')}. Please run autodiscover again.`
      })
    }
    zoneIdsToActivate = body.zoneIds
  } else {
    // Default: activate all zones from last discovery
    zoneIdsToActivate = lastDiscovery.zoneIds
  }

  if (zoneIdsToActivate.length === 0) {
    return {
      success: true,
      activatedCount: 0,
      message: 'No zones to activate.'
    }
  }

  // Add zones to the allowed list (with zone names if provided)
  const zonesWithNames = zoneIdsToActivate.map(zoneId => ({
    zoneId,
    zoneName: body?.zoneNames?.[zoneId] ?? undefined,
    source: 'autodiscover' as const
  }))

  await addAllowedZones(orgId, zonesWithNames)

  // Get the updated list
  const allowedZoneIds = await getAllowedZoneIds(orgId)

  return {
    success: true,
    activatedCount: zoneIdsToActivate.length,
    totalAllowedZones: allowedZoneIds.length,
    message: `Successfully activated ${zoneIdsToActivate.length} zone(s).`
  }
})


