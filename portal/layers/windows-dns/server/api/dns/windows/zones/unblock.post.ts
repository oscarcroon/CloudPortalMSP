import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { 
  removeBlockedZones,
  addAllowedZones,
  getBlockedZones,
  getAllowedZoneIds
} from '@windows-dns/server/lib/windows-dns/org-config'

/**
 * POST /api/dns/windows/zones/unblock
 * 
 * Unblocks (unhides) zones for an organization.
 * - Removes zones from blocked list
 * - Optionally adds zones to allowed list (activate)
 * 
 * Body: { zoneIds: string[], activate?: boolean, zoneNames?: Record<string, string> }
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
    throw createError({ statusCode: 403, message: 'No permission to unblock zones.' })
  }

  const body = await readBody(event)
  
  if (!body?.zoneIds || !Array.isArray(body.zoneIds) || body.zoneIds.length === 0) {
    throw createError({ statusCode: 400, message: 'zoneIds array is required.' })
  }

  const zoneIds: string[] = body.zoneIds
  const activate: boolean = body.activate ?? true // Default: activate after unblocking
  const zoneNames: Record<string, string> = body.zoneNames ?? {}

  // Get zone names from blocked zones if not provided
  const blockedZones = await getBlockedZones(orgId)
  const zoneNameMap = new Map(blockedZones.map(z => [z.zoneId, z.zoneName]))

  // Remove from blocked list
  await removeBlockedZones(orgId, zoneIds)

  let activatedCount = 0

  // Optionally add to allowed list
  if (activate) {
    const zonesToAllow = zoneIds.map(zoneId => ({
      zoneId,
      zoneName: zoneNames[zoneId] ?? zoneNameMap.get(zoneId) ?? undefined,
      source: 'manual' as const
    }))
    await addAllowedZones(orgId, zonesToAllow)
    activatedCount = zoneIds.length
  }

  // Get updated counts
  const allowedZoneIds = await getAllowedZoneIds(orgId)

  console.log(`[windows-dns] Unblocked ${zoneIds.length} zones for org ${orgId} (activate=${activate})`)

  return {
    success: true,
    unblockedCount: zoneIds.length,
    activatedCount,
    totalAllowed: allowedZoneIds.length
  }
})

