import { createError, defineEventHandler, setHeader } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { getAllowedZones } from '@windows-dns/server/lib/windows-dns/org-config'
import { formatBindZoneFile } from '@windows-dns/server/lib/windows-dns/format-bind'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const zoneId = event.context.params?.zoneId

  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'Zone ID is required.' })
  }

  // Check module access
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canExport) {
    throw createError({ statusCode: 403, message: 'No permission to export Windows DNS zones.' })
  }

  // Verify the zone is in the org's allowed zones and get the zone name
  const allowedZones = await getAllowedZones(orgId)
  const zone = allowedZones.find(z => z.zoneId === zoneId)
  if (!zone) {
    throw createError({ statusCode: 403, message: 'Zone is not accessible to this organization.' })
  }

  try {
    const client = await getClientForOrg(orgId)
    const records = await client.listRecordsForZone(zoneId)

    const zoneName = zone.zoneName ?? zoneId
    const content = formatBindZoneFile(zoneName, records)

    setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')

    return content
  } catch (error: any) {
    console.error(`[windows-dns] Export failed for zone ${zoneId}:`, error)
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to export zone file.'
    })
  }
})
