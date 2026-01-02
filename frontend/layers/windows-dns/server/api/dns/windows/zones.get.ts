import { createError, defineEventHandler, getQuery } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg, ensureAccount, WindowsDnsClient } from '@windows-dns/server/lib/windows-dns/client'
import { 
  getOrgConfig, 
  getOrgCoreId, 
  clearAccountId, 
  getAllowedZoneIds,
  getBlockedZoneIds,
  addAllowedZones,
  saveLastDiscovery,
  getLastDiscovery
} from '@windows-dns/server/lib/windows-dns/org-config'

/**
 * Auto-sync interval: how often autodiscover runs automatically (in ms).
 * Default: 24 hours. Can be forced with ?refresh=true.
 */
const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Helper to run autodiscover and auto-activate zones.
 * Respects blocklist: zones in blocklist are never auto-activated.
 * 
 * Architecture: Portal is the source of truth for zone ownership.
 * - Autodiscover finds zones matching COREID in the layer
 * - Portal saves allowed zones in its database (minus blocked ones)
 * - When listing zones, portal passes allowedZoneIds to the layer via token
 * - Layer trusts the token and returns only allowed zones
 */
async function runAutoSync(
  client: WindowsDnsClient,
  orgId: string,
  coreId: string
): Promise<{ zonesActivated: number; zones: any[]; totalDiscovered: number }> {
  console.log(`[windows-dns] Running auto-sync for org ${orgId} with coreId ${coreId}`)
  
  try {
    // Step 1: Run autodiscover to find matching zones
    console.log(`[windows-dns] Calling autodiscoverZones...`)
    const discoveredZones = await client.autodiscoverZones()
    console.log(`[windows-dns] Autodiscover found ${discoveredZones.length} matching zones:`, 
      discoveredZones.map(z => ({ id: z.id, name: z.zoneName, coreId: (z as any).coreIdMarkerValue })))
    
    // Step 2: Get current allowed and blocked zone IDs
    const [allowedZoneIds, blockedZoneIds] = await Promise.all([
      getAllowedZoneIds(orgId),
      getBlockedZoneIds(orgId)
    ])
    const allowedSet = new Set(allowedZoneIds)
    const blockedSet = new Set(blockedZoneIds)
    
    // Step 3: Find zones to activate (not already allowed AND not blocked)
    const zonesToActivate = discoveredZones.filter(z => 
      !allowedSet.has(z.id) && !blockedSet.has(z.id)
    )
    
    // Step 4: Save discovery result for reference
    const allDiscoveredIds = discoveredZones.map(z => z.id)
    await saveLastDiscovery(orgId, allDiscoveredIds, coreId)
    
    // Step 5: Auto-activate new zones (if any)
    if (zonesToActivate.length > 0) {
      await addAllowedZones(
        orgId,
        zonesToActivate.map(z => ({
          zoneId: z.id,
          zoneName: z.zoneName,
          source: 'autodiscover' as const
        }))
      )
      console.log(`[windows-dns] Auto-activated ${zonesToActivate.length} new zones for org ${orgId}`)
    }
    
    // Return all discovered zones that are now allowed (including pre-existing)
    const newAllowedSet = new Set([...allowedZoneIds, ...zonesToActivate.map(z => z.id)])
    const allowedZones = discoveredZones.filter(z => newAllowedSet.has(z.id))
    
    return {
      zonesActivated: zonesToActivate.length,
      zones: allowedZones,
      totalDiscovered: discoveredZones.length
    }
  } catch (error: any) {
    console.error(`[windows-dns] Auto-sync failed for org ${orgId}:`, error?.message || error)
    console.error(`[windows-dns] Auto-sync error details:`, error)
    // Don't throw - we'll continue with existing zones
    return { zonesActivated: 0, zones: [], totalDiscovered: 0 }
  }
}

/**
 * Check if auto-sync should run based on last discovery timestamp.
 */
function shouldRunAutoSync(lastDiscoveryAt: Date | null, forceRefresh: boolean): boolean {
  if (forceRefresh) return true
  if (!lastDiscoveryAt) return true
  
  const timeSinceLastSync = Date.now() - lastDiscoveryAt.getTime()
  return timeSinceLastSync >= AUTO_SYNC_INTERVAL_MS
}

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const query = getQuery(event)
  const forceRefresh = query.refresh === 'true'
  
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view DNS zones.' })
  }

  // Check if user has admin-level permissions for auto-sync
  const canAutoSync = moduleRights.canAutodiscover && moduleRights.canManageOwnership

  // Get CoreID from organizations.core_id (source of truth)
  const coreId = await getOrgCoreId(orgId)
  if (!coreId) {
    throw createError({
      statusCode: 400,
      message: 'DNS is not configured for this organization. Please set COREID in organization settings first.'
    })
  }
  
  // Ensure we're using the raw coreId, not prefixed
  const rawCoreId = coreId.startsWith('coreid:') ? coreId.slice(7) : coreId

  // Get org config
  let config = await getOrgConfig(orgId)
  let isNewSetup = false

  // Bootstrap: ensure account exists if not yet created
  if (!config?.windowsDnsAccountId) {
    isNewSetup = true
    const orgName = auth.currentOrgName ?? `Org ${orgId}`
    
    try {
      console.log(`[windows-dns] Creating new account for org ${orgId} with coreId ${rawCoreId}`)
      const { accountId, created } = await ensureAccount(config ?? { coreId: rawCoreId }, orgId, orgName, rawCoreId)
      console.log(`[windows-dns] Account ${accountId} ${created ? 'created' : 'already existed'}`)
      
      // Small delay to ensure account is fully committed
      if (created) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      config = await getOrgConfig(orgId)
    } catch (error: any) {
      console.error(`[windows-dns] Failed to ensure account for org ${orgId}:`, error)
      throw createError({
        statusCode: error?.statusCode ?? 502,
        message: error?.message ?? 'Failed to create DNS account.'
      })
    }
  }

  if (!config?.windowsDnsAccountId) {
    throw createError({
      statusCode: 400,
      message: 'DNS account not set up. Please configure DNS first.'
    })
  }

  // Check if we have any allowed zones and last discovery
  const [existingAllowedZones, lastDiscovery] = await Promise.all([
    getAllowedZoneIds(orgId),
    getLastDiscovery(orgId)
  ])
  
  console.log(`[windows-dns] isNewSetup=${isNewSetup}, existingAllowedZones=${existingAllowedZones.length}, canAutoSync=${canAutoSync}`)

  try {
    const client = await getClientForOrg(orgId)
    
    // Determine if auto-sync should run
    const shouldSync = canAutoSync && (
      isNewSetup || 
      existingAllowedZones.length === 0 || 
      shouldRunAutoSync(lastDiscovery?.discoveredAt ?? null, forceRefresh)
    )
    
    if (shouldSync) {
      console.log(`[windows-dns] Triggering auto-sync (isNewSetup=${isNewSetup}, allowedZones=${existingAllowedZones.length}, forceRefresh=${forceRefresh})`)
      const { zonesActivated, zones: syncedZones, totalDiscovered } = await runAutoSync(client, orgId, rawCoreId)
      
      if (syncedZones.length > 0 || zonesActivated > 0) {
        // Return the synced zones
        return {
          zones: syncedZones,
          autoSetup: {
            performed: true,
            zonesActivated,
            totalDiscovered
          },
          moduleRights: {
            canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
            canEditRecords: moduleRights.canEditRecords,
            canAutodiscover: moduleRights.canAutodiscover,
            canManageOrgConfig: moduleRights.canManageOrgConfig,
            canManageOwnership: moduleRights.canManageOwnership
          }
        }
      }
      
      // If sync ran but found no zones, check if there are existing allowed zones to show
      if (existingAllowedZones.length > 0) {
        const zones = await client.listZones(existingAllowedZones)
        return {
          zones,
          autoSetup: {
            performed: true,
            zonesActivated: 0,
            totalDiscovered
          },
          moduleRights: {
            canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
            canEditRecords: moduleRights.canEditRecords,
            canAutodiscover: moduleRights.canAutodiscover,
            canManageOrgConfig: moduleRights.canManageOrgConfig,
            canManageOwnership: moduleRights.canManageOwnership
          }
        }
      }
      
      // No zones found at all - return empty with message
      return {
        zones: [],
        autoSetup: {
          performed: true,
          zonesActivated: 0,
          message: 'No matching zones found. Make sure your DNS zones have a TXT record with COREID=' + rawCoreId
        },
        moduleRights: {
          canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
          canEditRecords: moduleRights.canEditRecords,
          canAutodiscover: moduleRights.canAutodiscover,
          canManageOrgConfig: moduleRights.canManageOrgConfig,
          canManageOwnership: moduleRights.canManageOwnership
        }
      }
    }

    // Non-admin or within throttle window: just list existing allowed zones
    if (existingAllowedZones.length === 0) {
      // No zones and user can't auto-sync - provide helpful message
      return {
        zones: [],
        needsAdminSetup: !canAutoSync,
        moduleRights: {
          canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
          canEditRecords: moduleRights.canEditRecords,
          canAutodiscover: moduleRights.canAutodiscover,
          canManageOrgConfig: moduleRights.canManageOrgConfig,
          canManageOwnership: moduleRights.canManageOwnership
        }
      }
    }

    // Normal case: zones already activated, list only allowed zones
    const zones = await client.listZones(existingAllowedZones)

    return {
      zones,
      moduleRights: {
        canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
        canEditRecords: moduleRights.canEditRecords,
        canAutodiscover: moduleRights.canAutodiscover,
        canManageOrgConfig: moduleRights.canManageOrgConfig,
        canManageOwnership: moduleRights.canManageOwnership
      }
    }
  } catch (error: any) {
    // Auto-healing: if account not found in layer, clear the local accountId and retry
    if (error?.statusCode === 404 && error?.message?.includes('not found')) {
      console.log(`[windows-dns] Account not found in layer, attempting auto-healing for org ${orgId}`)
      await clearAccountId(orgId)
      
      // Re-create account
      const orgName = auth.currentOrgName ?? `Org ${orgId}`
      try {
        const { accountId, created } = await ensureAccount({ coreId: rawCoreId }, orgId, orgName, rawCoreId)
        console.log(`[windows-dns] Auto-healed account: ${accountId}`)
        
        // Small delay for new account
        if (created) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        config = await getOrgConfig(orgId)
        
        if (config?.windowsDnsAccountId && canAutoSync) {
          // Get new client and run auto-sync
          const client = await getClientForOrg(orgId)
          const { zonesActivated, zones: syncedZones } = await runAutoSync(client, orgId, rawCoreId)
          
          return {
            zones: syncedZones,
            autoSetup: {
              performed: true,
              zonesActivated,
              autoHealed: true
            },
            moduleRights: {
              canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
              canEditRecords: moduleRights.canEditRecords,
              canAutodiscover: moduleRights.canAutodiscover,
              canManageOrgConfig: moduleRights.canManageOrgConfig,
              canManageOwnership: moduleRights.canManageOwnership
            }
          }
        }
        
        // Non-admin after auto-heal - list existing zones
        const healedAllowedZones = await getAllowedZoneIds(orgId)
        if (healedAllowedZones.length > 0 && config?.windowsDnsAccountId) {
          const client = await getClientForOrg(orgId)
          const zones = await client.listZones(healedAllowedZones)
          return {
            zones,
            autoSetup: {
              performed: true,
              zonesActivated: 0,
              autoHealed: true
            },
            moduleRights: {
              canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
              canEditRecords: moduleRights.canEditRecords,
              canAutodiscover: moduleRights.canAutodiscover,
              canManageOrgConfig: moduleRights.canManageOrgConfig,
              canManageOwnership: moduleRights.canManageOwnership
            }
          }
        }
        
        return {
          zones: [],
          autoSetup: {
            performed: true,
            zonesActivated: 0,
            autoHealed: true
          },
          moduleRights: {
            canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
            canEditRecords: moduleRights.canEditRecords,
            canAutodiscover: moduleRights.canAutodiscover,
            canManageOrgConfig: moduleRights.canManageOrgConfig,
            canManageOwnership: moduleRights.canManageOwnership
          }
        }
      } catch (retryError: any) {
        console.error(`[windows-dns] Auto-healing failed for org ${orgId}:`, retryError)
      }
    }
    
    throw createError({
      statusCode: error?.statusCode ?? 502,
        message: error?.message ?? 'Failed to fetch zones from DNS.'
    })
  }
})
