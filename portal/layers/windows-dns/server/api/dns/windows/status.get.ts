import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import {
  getOrgConfig,
  getOrgCoreId,
  getAllowedZoneIds,
  getLastDiscovery
} from '@windows-dns/server/lib/windows-dns/org-config'

/**
 * GET /api/dns/windows/status
 * 
 * Returns the current Windows DNS configuration status for the organization.
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view DNS status.' })
  }

  // Get CoreID from organizations.core_id (source of truth)
  const coreId = await getOrgCoreId(orgId)
  const config = await getOrgConfig(orgId)
  const allowedZoneIds = await getAllowedZoneIds(orgId)
  const lastDiscovery = await getLastDiscovery(orgId)

  return {
    coreId,
    hasCoreId: !!coreId,
    windowsDnsAccountId: config?.windowsDnsAccountId ?? null,
    hasAccount: !!config?.windowsDnsAccountId,
    instanceId: config?.instanceId ?? null,
    enabledAt: config?.enabledAt ?? null,
    lastValidatedAt: config?.lastValidatedAt ?? null,
    lastSyncAt: config?.lastSyncAt ?? null,
    lastSyncStatus: config?.lastSyncStatus ?? null,
    lastSyncError: config?.lastSyncError ?? null,
    allowedZonesCount: allowedZoneIds.length,
    lastDiscovery: lastDiscovery
      ? {
          discoveredAt: lastDiscovery.discoveredAt,
          zonesCount: lastDiscovery.zoneIds.length,
          coreIdSnapshot: lastDiscovery.coreIdSnapshot
        }
      : null,
    moduleRights: {
      canView: moduleRights.canView,
      canCreateZones: moduleRights.canCreateZones,
      canEditZones: moduleRights.canEditZones,
      canEditRecords: moduleRights.canEditRecords,
      canManageOwnership: moduleRights.canManageOwnership,
      canAutodiscover: moduleRights.canAutodiscover,
      canManageOrgConfig: moduleRights.canManageOrgConfig
    }
  }
})


