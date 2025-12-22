import { createError, defineEventHandler, getQuery } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg, ensureAccount, WindowsDnsClient } from '@windows-dns/server/lib/windows-dns/client'
import { 
  getOrgConfig, 
  getOrgCoreId, 
  clearAccountId, 
  getAllowedZoneIds,
  addAllowedZones,
  saveLastDiscovery
} from '@windows-dns/server/lib/windows-dns/org-config'

/**
 * Helper to run autodiscover and auto-activate zones for first-time setup.
 * 
 * Architecture: Portal is the source of truth for zone ownership.
 * - Autodiscover finds zones matching COREID in the layer
 * - Portal saves allowed zones in its database
 * - When listing zones, portal passes allowedZoneIds to the layer via token
 * - Layer trusts the token and returns only allowed zones
 * 
 * No "claim" step needed - the layer doesn't track ownership itself.
 */
async function runAutoSetup(
  client: WindowsDnsClient,
  orgId: string,
  coreId: string
): Promise<{ zonesActivated: number; zones: any[] }> {
  console.log(`[windows-dns] Running automatic setup for org ${orgId} with coreId ${coreId}`)
  
  try {
    // Step 1: Run autodiscover to find matching zones
    console.log(`[windows-dns] Calling autodiscoverZones...`)
    const discoveredZones = await client.autodiscoverZones()
    console.log(`[windows-dns] Autodiscover found ${discoveredZones.length} matching zones:`, 
      discoveredZones.map(z => ({ id: z.id, name: z.zoneName, coreId: (z as any).coreIdMarkerValue })))
    
    if (discoveredZones.length === 0) {
      return { zonesActivated: 0, zones: [] }
    }
    
    // Step 2: Save discovery result and allowed zones in portal database
    // This is the source of truth for zone ownership
    const zoneIds = discoveredZones.map(z => z.id)
    await saveLastDiscovery(orgId, zoneIds, coreId)
    
    await addAllowedZones(
      orgId,
      discoveredZones.map(z => ({
        zoneId: z.id,
        zoneName: z.zoneName,
        source: 'autodiscover' as const
      }))
    )
    
    console.log(`[windows-dns] Auto-activated ${discoveredZones.length} zones for org ${orgId}`)
    
    return {
      zonesActivated: discoveredZones.length,
      zones: discoveredZones
    }
  } catch (error: any) {
    console.error(`[windows-dns] Auto-setup failed for org ${orgId}:`, error?.message || error)
    console.error(`[windows-dns] Auto-setup error details:`, error)
    // Don't throw - we'll continue and let the user manually run autodiscover
    return { zonesActivated: 0, zones: [] }
  }
}

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view Windows DNS zones.' })
  }

  // Get CoreID from organizations.core_id (source of truth)
  const coreId = await getOrgCoreId(orgId)
  if (!coreId) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS is not configured for this organization. Please set COREID in organization settings first.'
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
        message: error?.message ?? 'Failed to create Windows DNS account.'
      })
    }
  }

  if (!config?.windowsDnsAccountId) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS account not set up. Please configure Windows DNS first.'
    })
  }

  // Check if we have any allowed zones
  const existingAllowedZones = await getAllowedZoneIds(orgId)
  console.log(`[windows-dns] isNewSetup=${isNewSetup}, existingAllowedZones=${existingAllowedZones.length}`, existingAllowedZones)

  try {
    const client = await getClientForOrg(orgId)
    
    // If this is a new setup or no zones are activated, run auto-setup
    if (isNewSetup || existingAllowedZones.length === 0) {
      console.log(`[windows-dns] Triggering auto-setup (isNewSetup=${isNewSetup}, allowedZones=${existingAllowedZones.length})`)
      const { zonesActivated, zones: discoveredZones } = await runAutoSetup(client, orgId, rawCoreId)
      
      if (zonesActivated > 0) {
        // Return the discovered zones directly (they're now activated)
        return {
          zones: discoveredZones,
          autoSetup: {
            performed: true,
            zonesActivated
          },
          moduleRights: {
            canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
            canEditRecords: moduleRights.canEditRecords,
            canAutodiscover: moduleRights.canAutodiscover,
            canManageOrgConfig: moduleRights.canManageOrgConfig
          }
        }
      }
      
      // No zones found - still return empty list but indicate setup was attempted
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
          canManageOrgConfig: moduleRights.canManageOrgConfig
        }
      }
    }

    // Normal case: zones already activated, list only allowed zones
    // Portal is source of truth - pass allowedZoneIds to layer
    const zones = await client.listZones(existingAllowedZones)

    return {
      zones,
      moduleRights: {
        canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
        canEditRecords: moduleRights.canEditRecords,
        canAutodiscover: moduleRights.canAutodiscover,
        canManageOrgConfig: moduleRights.canManageOrgConfig
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
        
        if (config?.windowsDnsAccountId) {
          // Get new client and run auto-setup
          const client = await getClientForOrg(orgId)
          const { zonesActivated, zones: discoveredZones } = await runAutoSetup(client, orgId, rawCoreId)
          
          if (zonesActivated > 0) {
            return {
              zones: discoveredZones,
              autoSetup: {
                performed: true,
                zonesActivated,
                autoHealed: true
              },
              moduleRights: {
                canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
                canEditRecords: moduleRights.canEditRecords,
                canAutodiscover: moduleRights.canAutodiscover,
                canManageOrgConfig: moduleRights.canManageOrgConfig
              }
            }
          }
          
          // No zones found after auto-healing - get allowed zones and list them
          const healedAllowedZones = await getAllowedZoneIds(orgId)
          const zones = await client.listZones(healedAllowedZones.length > 0 ? healedAllowedZones : '*')
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
              canManageOrgConfig: moduleRights.canManageOrgConfig
            }
          }
        }
      } catch (retryError: any) {
        console.error(`[windows-dns] Auto-healing failed for org ${orgId}:`, retryError)
      }
    }
    
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to fetch zones from Windows DNS.'
    })
  }
})
