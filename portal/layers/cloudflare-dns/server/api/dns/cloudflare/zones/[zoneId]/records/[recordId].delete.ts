import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsZoneAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getClientForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/client'
import { logAuditEvent } from '~~/server/utils/audit'

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
    throw createError({ statusCode: 403, message: 'Saknar rättighet att ta bort records.' })
  }

  const client = await getClientForOrg(orgId)
  await client.deleteRecord(zoneId, recordId)

  // Audit log
  await logAuditEvent(event, 'CLOUDFLARE_DNS_RECORD_DELETED', {
    moduleKey: 'cloudflare-dns',
    entityType: 'record',
    entityId: recordId,
    zoneId
  })

  return { ok: true }
})


