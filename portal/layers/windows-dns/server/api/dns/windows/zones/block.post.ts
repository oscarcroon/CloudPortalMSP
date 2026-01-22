import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { 
  removeAllowedZones,
  addBlockedZones,
  getAllowedZones,
  getBlockedZoneIds
} from '@windows-dns/server/lib/windows-dns/org-config'

/**
 * POST /api/dns/windows/zones/block
 * 
 * Blocks (hides) zones from an organization.
 * - Removes zones from allowed list
 * - Adds zones to blocked list (prevents auto-reactivation)
 * 
 * Body: { zoneIds: string[], zoneNames?: Record<string, string> }
 * 
 * Requires: canManageOwnership
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canManageOwnership) {
    throw createError({ statusCode: 403, message: 'No permission to block zones.' })
  }

  const body = await readBody(event)
  
  if (!body?.zoneIds || !Array.isArray(body.zoneIds) || body.zoneIds.length === 0) {
    throw createError({ statusCode: 400, message: 'zoneIds array is required.' })
  }

  const zoneIds: string[] = body.zoneIds
  const zoneNames: Record<string, string> = body.zoneNames ?? {}

  // Get zone names from allowed zones if not provided
  const allowedZones = await getAllowedZones(orgId)
  const zoneNameMap = new Map(allowedZones.map(z => [z.zoneId, z.zoneName]))

  // Remove from allowed list
  await removeAllowedZones(orgId, zoneIds)

  // Add to blocked list with zone names
  const zonesToBlock = zoneIds.map(zoneId => ({
    zoneId,
    zoneName: zoneNames[zoneId] ?? zoneNameMap.get(zoneId) ?? undefined
  }))
  await addBlockedZones(orgId, zonesToBlock)

  // Get updated counts
  const blockedZoneIds = await getBlockedZoneIds(orgId)

  console.log(`[windows-dns] Blocked ${zoneIds.length} zones for org ${orgId}`)

  return {
    success: true,
    blockedCount: zoneIds.length,
    totalBlocked: blockedZoneIds.length
  }
})

