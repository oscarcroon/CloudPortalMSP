import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg, ensureAccount } from '@windows-dns/server/lib/windows-dns/client'
import { getOrgConfig, getOrgCoreId, saveLastDiscovery, clearAccountId } from '@windows-dns/server/lib/windows-dns/org-config'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canAutodiscover) {
    throw createError({ statusCode: 403, message: 'No permission to run autodiscover.' })
  }

  // Get CoreID from organizations.core_id (source of truth)
  // This should return the RAW coreId (e.g., "CORE"), not prefixed
  const coreId = await getOrgCoreId(orgId)
  console.log(`[windows-dns] getOrgCoreId returned: "${coreId}" for org ${orgId}`)
  
  if (!coreId) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS is not configured for this organization. Please set COREID in organization settings first.'
    })
  }
  
  // Ensure we're using the raw coreId, not prefixed
  const rawCoreId = coreId.startsWith('coreid:') ? coreId.slice(7) : coreId
  console.log(`[windows-dns] Using rawCoreId: "${rawCoreId}" for autodiscover`)

  // Get org config
  let config = await getOrgConfig(orgId)

  // Bootstrap: ensure account exists if not yet created
  if (!config?.windowsDnsAccountId) {
    try {
      const orgName = auth.currentOrgName ?? `Org ${orgId}`
      console.log(`[windows-dns] Ensuring account for org ${orgId} with rawCoreId ${rawCoreId}`)
      const { accountId, created } = await ensureAccount(config ?? { coreId: rawCoreId }, orgId, orgName, rawCoreId)
      console.log(`[windows-dns] Account ensured: ${accountId} (created: ${created})`)
      
      // Reload config to get the updated accountId
      config = await getOrgConfig(orgId)
      
      if (!config?.windowsDnsAccountId) {
        throw createError({
          statusCode: 500,
          message: 'Failed to save Windows DNS account ID after creation. Please try again.'
        })
      }

      // Small delay to ensure account is fully committed in WindowsDNS layer
      // This helps avoid race conditions where token minting happens before account is visible
      if (created) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } catch (error: any) {
      // Re-throw with better context
      console.error(`[windows-dns] Failed to ensure account for org ${orgId}:`, error)
      throw createError({
        statusCode: error?.statusCode ?? 502,
        message: error?.message ?? 'Failed to create Windows DNS account. Please check that WindowsDNS layer is accessible and configured correctly.'
      })
    }
  }

  try {
    const client = await getClientForOrg(orgId)
    const zones = await client.autodiscoverZones()

    // Save the discovery result for validation during activate
    const zoneIds = zones.map(z => z.id)
    await saveLastDiscovery(orgId, zoneIds, rawCoreId)

    return {
      zones,
      coreId: rawCoreId, // Return the RAW coreId, not prefixed
      discoveredAt: new Date().toISOString()
    }
  } catch (error: any) {
    // Auto-healing: if account not found in layer, clear the local accountId and retry
    if (error?.statusCode === 404 && error?.message?.includes('not found')) {
      console.log(`[windows-dns] Account not found in layer during autodiscover, attempting auto-healing for org ${orgId}`)
      await clearAccountId(orgId)
      
      // Re-create account and retry
      const orgName = auth.currentOrgName ?? `Org ${orgId}`
      try {
        const { accountId } = await ensureAccount({ coreId: rawCoreId }, orgId, orgName, rawCoreId)
        console.log(`[windows-dns] Auto-healing successful, new accountId: ${accountId}`)
        
        // Retry autodiscover
        const client = await getClientForOrg(orgId)
        const zones = await client.autodiscoverZones()
        
        const zoneIds = zones.map(z => z.id)
        await saveLastDiscovery(orgId, zoneIds, rawCoreId)
        
        return {
          zones,
          coreId: rawCoreId, // Return the RAW coreId, not prefixed
          discoveredAt: new Date().toISOString()
        }
      } catch (retryError: any) {
        console.error(`[windows-dns] Auto-healing failed during autodiscover for org ${orgId}:`, retryError)
        throw createError({
          statusCode: retryError?.statusCode ?? 502,
          message: retryError?.message ?? 'Failed to recreate Windows DNS account. Please check that WindowsDNS layer is accessible.'
        })
      }
    }
    
    // Improve error message
    const errorMessage = error?.message || 'Unknown error'
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: `Autodiscover failed: ${errorMessage}. Please verify that WindowsDNS layer is running and accessible.`
    })
  }
})
