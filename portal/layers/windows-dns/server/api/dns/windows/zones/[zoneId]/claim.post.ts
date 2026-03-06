import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getOrgConfig, getOrgCoreId, addAllowedZones } from '@windows-dns/server/lib/windows-dns/org-config'
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

  // Get CoreID from organizations.core_id (source of truth)
  const coreId = await getOrgCoreId(orgId)
  if (!coreId) {
    throw createError({
      statusCode: 400,
      message: 'DNS is not configured for this organization. Please set COREID first.'
    })
  }

  const config = await getOrgConfig(orgId)
  if (!config?.windowsDnsAccountId) {
    throw createError({
      statusCode: 400,
      message: 'DNS account not configured. Please enable DNS first.'
    })
  }

  try {
    // Use ownership.write scope to claim the zone
    const token = await getToken(
      config,
      orgId,
      ['ownership.write'],
      [zoneId], // Only allow this specific zone
      false // Use explicit zone selector, not account_set
    )

    // Add the zone to the allowed list
    await addAllowedZones(orgId, [{ zoneId, source: 'manual' }])

    return { success: true, zoneId }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to claim zone.'
    })
  }
})
