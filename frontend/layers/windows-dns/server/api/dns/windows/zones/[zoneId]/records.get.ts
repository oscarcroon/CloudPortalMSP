import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'

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
    const records = await client.listRecords(zoneId)

    return {
      records,
      access: {
        canEditRecords: moduleRights.canEditRecords
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to fetch records.'
    })
  }
})

