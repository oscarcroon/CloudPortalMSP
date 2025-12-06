import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsZoneAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getClientForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/client'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId
  const orgRole = auth.orgRoles?.[orgId]
  const zoneId = getRouterParam(event, 'zoneId')
  const recordId = getRouterParam(event, 'recordId')

  if (!zoneId || !recordId) {
    throw createError({ statusCode: 400, message: 'zoneId och recordId krävs.' })
  }

  const access = await getCloudflareDnsZoneAccessForUser(orgId, auth.user.id, orgRole, zoneId)
  if (!access.canEditRecords) {
    throw createError({ statusCode: 403, message: 'Saknar rättighet att uppdatera records.' })
  }

  const body = await readBody<{
    type?: string
    name?: string
    content?: string
    ttl?: number | null
    proxied?: boolean | null
    priority?: number | null
  }>(event)

  const client = await getClientForOrg(orgId)
  const record = await client.updateRecord(zoneId, recordId, {
    type: body?.type,
    name: body?.name,
    content: body?.content,
    ttl: body?.ttl ?? undefined,
    proxied: body?.proxied ?? undefined,
    priority: body?.priority ?? undefined
  })

  return { record }
})


