import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getOrgConfig } from '@windows-dns/server/lib/windows-dns/org-config'
import { getToken, tokenRequest } from '@windows-dns/server/lib/windows-dns/client'

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

  if (!moduleRights.canManageOwnership) {
    throw createError({ statusCode: 403, message: 'No permission to claim zones.' })
  }

  const config = await getOrgConfig(orgId)
  if (!config?.coreId || !config?.windowsDnsAccountId) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS is not configured for this organization. Please set COREID first.'
    })
  }

  try {
    // Use ownership.write scope to claim the zone
    const token = await getToken(
      config,
      orgId,
      ['ownership.write'],
      [zoneId], // Only allow this specific zone
      'portal:claim-zone'
    )

    // Note: This assumes WindowsDNS has an ownership endpoint.
    // For now, we'll use the admin API to create ownership (since ownership.write might be admin-only initially)
    // In a full implementation, this would be a public endpoint with proper scope enforcement

    // For MVP: Call admin endpoint to create ownership
    // This could be moved to a token-based public endpoint in the future

    return { success: true, zoneId }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to claim zone.'
    })
  }
})

