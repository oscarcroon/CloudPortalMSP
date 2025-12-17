import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canCreateZones) {
    throw createError({ statusCode: 403, message: 'No permission to create DNS zones.' })
  }

  const body = await readBody(event)
  if (!body?.zoneName || !body?.zoneType || !body?.serverId) {
    throw createError({
      statusCode: 400,
      message: 'zoneName, zoneType, and serverId are required.'
    })
  }

  try {
    const client = await getClientForOrg(orgId)
    const zone = await client.createZone(body.zoneName, body.zoneType, body.serverId)

    return { zone }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to create zone.'
    })
  }
})

