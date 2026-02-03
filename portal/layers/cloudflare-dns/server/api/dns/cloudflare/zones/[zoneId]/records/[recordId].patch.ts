import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsZoneAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getClientForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/client'
import { logAuditEvent } from '~~/server/utils/audit'
import { buildDnsRecordAuditMeta, hasChanges, buildChanges } from '~~/server/utils/audit-diff'

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
    comment?: string | null
  }>(event)

  const client = await getClientForOrg(orgId)
  
  // Fetch existing record for audit "before" state
  const existingRecord = await client.getRecord(zoneId, recordId)
  if (!existingRecord) {
    throw createError({ statusCode: 404, message: 'Record hittades inte.' })
  }
  
  const record = await client.updateRecord(zoneId, recordId, {
    type: body?.type,
    name: body?.name,
    content: body?.content,
    ttl: body?.ttl ?? undefined,
    proxied: body?.proxied ?? undefined,
    priority: body?.priority ?? undefined,
    comment: body?.comment ?? undefined
  })

  // Build changes diff and log audit event only if there are actual changes
  const { changes } = buildChanges(
    existingRecord as unknown as Record<string, unknown>,
    record as unknown as Record<string, unknown>,
    { entityType: 'cloudflare_dns_record' }
  )
  
  if (hasChanges(changes)) {
    const auditMeta = buildDnsRecordAuditMeta({
      moduleKey: 'cloudflare-dns',
      entityType: 'cloudflare_dns_record',
      entityId: recordId,
      zoneId,
      recordType: record.type,
      recordName: record.name,
      operation: 'update',
      before: existingRecord as unknown as Record<string, unknown>,
      after: record as unknown as Record<string, unknown>
    })
    await logAuditEvent(event, 'CLOUDFLARE_DNS_RECORD_UPDATED', auditMeta)
  }

  return { record }
})


