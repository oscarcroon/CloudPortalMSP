import { createError, defineEventHandler, setHeader } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { getAllowedZoneIds } from '@windows-dns/server/lib/windows-dns/org-config'

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
  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view Windows DNS zones.' })
  }

  // Verify the zone is in the org's allowed zones
  const allowedZoneIds = await getAllowedZoneIds(orgId)
  if (!allowedZoneIds.includes(zoneId)) {
    throw createError({ statusCode: 403, message: 'Zone is not accessible to this organization.' })
  }

  try {
    const client = await getClientForOrg(orgId)
    const content = await client.exportZone(zoneId)

    // Set headers for file download
    setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    // We'll let the frontend handle the filename since we don't have zoneName here easily
    // The Content-Disposition header will be set by frontend or we can fetch zone info

    return content
  } catch (error: any) {
    console.error(`[windows-dns] Export failed for zone ${zoneId}:`, error)
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to export zone file.'
    })
  }
})

