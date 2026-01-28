import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'

/**
 * Check if a record name represents the reserved COREID marker subdomain.
 * Used to filter out the _coreid marker from UI.
 */
function isCoreIdMarkerRecord(recordName: string, zoneName?: string): boolean {
  const name = recordName.toLowerCase().replace(/\.$/, '')
  if (name === '_coreid') return true
  if (zoneName) {
    const expected = `_coreid.${zoneName.toLowerCase()}`
    if (name === expected) return true
  }
  if (name.startsWith('_coreid.')) return true
  return false
}

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

  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view DNS records.' })
  }

  try {
    const client = await getClientForOrg(orgId)
    // Use listRecordsForZone which explicitly grants access to this specific zone
    const records = await client.listRecordsForZone(zoneId)

    // Filter out the reserved _coreid marker record from UI display
    const filteredRecords = records.filter((record: any) => {
      return !isCoreIdMarkerRecord(record.name)
    })

    return {
      records: filteredRecords,
      access: {
        canEditRecords: moduleRights.canEditRecords,
        canEditZones: moduleRights.canEditZones
      }
    }
  } catch (error: any) {
    console.error(`[windows-dns] Failed to fetch records for zone ${zoneId}:`, error?.message || error)
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to fetch records.'
    })
  }
})

