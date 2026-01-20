import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getClientForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/client'
import { getCloudflareDnsZoneAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId
  const orgRole = auth.orgRoles?.[orgId]
  const zoneId = getRouterParam(event, 'zoneId')

  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'zoneId saknas.' })
  }

  const access = await getCloudflareDnsZoneAccessForUser(orgId, auth.user.id, orgRole, zoneId)
  if (!access.canView) {
    throw createError({ statusCode: 403, message: 'Ingen behörighet att se records i zonen.' })
  }

  const client = await getClientForOrg(orgId)
  const records = await client.listRecords(zoneId)

  return {
    records,
    access: {
      canEditRecords: access.canEditRecords,
      canManageAcls: access.canManageAcls,
      zoneRole: access.zoneRole
    }
  }
})


