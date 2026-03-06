import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsZoneAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getClientForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/client'
import { logAuditEvent } from '~~/server/utils/audit'
import { buildDnsRecordAuditMeta } from '~~/server/utils/audit-diff'

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
  if (!access.canEditRecords) {
    throw createError({ statusCode: 403, message: 'Saknar rättighet att skapa records i zonen.' })
  }

  const body = await readBody<{
    type?: string
    name?: string
    content?: string
    ttl?: number | null
    proxied?: boolean | null
    priority?: number | null
    comment?: string | null
  }>(event)

  if (!body?.type || !body.name || !body.content) {
    throw createError({
      statusCode: 400,
      message: 'type, name och content är obligatoriska.'
    })
  }

  const client = await getClientForOrg(orgId)
  const record = await client.createRecord(zoneId, {
    type: body.type,
    name: body.name,
    content: body.content,
    ttl: body.ttl ?? null,
    proxied: body.proxied ?? null,
    priority: body.priority ?? null,
    comment: body.comment ?? null
  })

  // Audit log with changes
  const auditMeta = buildDnsRecordAuditMeta({
    moduleKey: 'cloudflare-dns',
    entityType: 'cloudflare_dns_record',
    entityId: record.id,
    zoneId,
    recordType: record.type,
    recordName: record.name,
    operation: 'create',
    before: null,
    after: record as unknown as Record<string, unknown>
  })
  await logAuditEvent(event, 'CLOUDFLARE_DNS_RECORD_CREATED', auditMeta)

  return { record }
})


