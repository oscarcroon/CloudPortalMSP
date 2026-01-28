import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { removeAllowedZones } from '@windows-dns/server/lib/windows-dns/org-config'

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

  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  // Require zones:write permission to delete zones
  if (!moduleRights.canEditZones) {
    throw createError({ statusCode: 403, message: 'No permission to delete DNS zones.' })
  }

  try {
    const client = await getClientForOrg(orgId)
    
    // Delete zone from Windows DNS backend
    await client.deleteZone(zoneId)
    console.log(`[windows-dns] Zone ${zoneId} deleted from backend`)

    // Remove zone from allowed zones for this organization
    await removeAllowedZones(orgId, [zoneId])
    console.log(`[windows-dns] Zone ${zoneId} removed from allowed zones for org ${orgId}`)

    return { success: true, deleted: true }
  } catch (error: any) {
    console.error(`[windows-dns] Failed to delete zone ${zoneId}:`, error)
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to delete zone.'
    })
  }
})

