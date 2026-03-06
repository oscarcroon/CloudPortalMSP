import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { assertNotSoa } from '@windows-dns/server/utils/assert-not-soa'
import { logAuditEvent } from '~~/server/utils/audit'
import { buildDnsRecordAuditMeta } from '~~/server/utils/audit-diff'

/**
 * Check if a record name represents the reserved COREID marker subdomain.
 */
function isCoreIdMarkerRecord(recordName: string, zoneName?: string): boolean {
  const name = recordName.toLowerCase().replace(/\.$/, '')
  if (name === '_coreid') return true
  if (zoneName) {
    const expected = `_coreid.${zoneName.toLowerCase()}`
    if (name === expected) return true
  }
  if (name.startsWith('_coreid.')) return true
  return false
}

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

  if (!moduleRights.canEditRecords) {
    throw createError({ statusCode: 403, message: 'No permission to delete DNS records.' })
  }

  const body = await readBody(event)
  if (!body?.name || !body?.type) {
    throw createError({
      statusCode: 400,
      message: 'name and type are required.'
    })
  }

  // Block SOA record deletion - SOA is managed via Zone settings
  assertNotSoa(body.type)

  // Guard: Block deletion of reserved _coreid marker record
  if (isCoreIdMarkerRecord(body.name)) {
    throw createError({
      statusCode: 403,
      message: 'Kan inte ta bort _coreid-markörposten. Denna post hanteras av systemet.'
    })
  }

  try {
    const client = await getClientForOrg(orgId)
    
    // Fetch existing record for audit "before" state if recordId is available
    let existingRecord: Record<string, unknown> | null = null
    if (body.recordId) {
      const records = await client.listRecordsForZone(zoneId)
      existingRecord = (records.find((r: any) => r.id === body.recordId) as unknown as Record<string, unknown>) || null
    }
    
    await client.deleteRecord(zoneId, {
      name: body.name,
      type: body.type,
      content: body.content
    })

    // Log audit event for record deletion with changes
    const auditMeta = buildDnsRecordAuditMeta({
      moduleKey: 'windows-dns',
      entityType: 'windows_dns_record',
      entityId: body.recordId ?? null,
      zoneId,
      zoneName: undefined, // Not available in this endpoint
      recordType: body.type,
      recordName: body.name,
      operation: 'delete',
      before: existingRecord || {
        type: body.type,
        name: body.name,
        content: body.content
      },
      after: null
    })
    await logAuditEvent(event, 'WINDOWS_DNS_RECORD_DELETED', auditMeta)

    return { success: true }
  } catch (error: any) {
    // Parse error message for better UX
    const errorMessage = error?.message ?? 'Failed to delete record.'
    
    // Provide user-friendly error messages
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      throw createError({
        statusCode: 404,
        message: 'DNS-posten hittades inte. Den kan redan ha tagits bort.'
      })
    }
    
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: errorMessage
    })
  }
})

