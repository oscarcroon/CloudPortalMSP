import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
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
  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'zoneId saknas.' })
  }

  const access = await getCloudflareDnsZoneAccessForUser(orgId, auth.user.id, orgRole, zoneId)
  if (!access.canImport) {
    throw createError({ statusCode: 403, message: 'Saknar rättighet att importera records till zonen.' })
  }

  const body = await readBody<{ content?: string; filename?: string }>(event)
  if (!body?.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
    throw createError({ statusCode: 400, message: 'content är obligatoriskt.' })
  }

  const filename = body.filename ?? 'import.txt'

  const client = await getClientForOrg(orgId)
  const result = await client.importZone(zoneId, body.content, filename)

  await logAuditEvent(event, 'CLOUDFLARE_DNS_ZONE_IMPORTED', {
    moduleKey: 'cloudflare-dns',
    entityType: 'cloudflare_dns_zone',
    entityId: zoneId,
    recsAdded: result.recsAdded,
    totalRecordsParsed: result.totalRecordsParsed,
    filename
  })

  return {
    success: true,
    recsAdded: result.recsAdded,
    totalRecordsParsed: result.totalRecordsParsed,
    messages: result.messages
  }
})
