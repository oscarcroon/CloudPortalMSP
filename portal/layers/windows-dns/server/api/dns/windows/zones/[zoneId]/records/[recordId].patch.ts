import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsRedirects, windowsDnsAllowedZones } from '~~/server/database/schema'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { normalizeTxtContent } from '@windows-dns/lib/normalize-txt'
import { assertNotSoa, assertRecordNotSoa, isSoaType } from '@windows-dns/server/utils/assert-not-soa'
import { logAuditEvent } from '~~/server/utils/audit'
import { buildDnsRecordAuditMeta, hasChanges, buildChanges } from '~~/server/utils/audit-diff'

const MAX_COMMENT_LENGTH = 2000

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

/**
 * Check if updating this record would conflict with a redirect.
 */
async function checkRedirectConflict(
  orgId: string,
  zoneId: string,
  zoneName: string,
  recordName: string,
  recordType: string
): Promise<string | null> {
  const conflictTypes = ['A', 'AAAA', 'CNAME']
  if (!conflictTypes.includes(recordType.toUpperCase())) {
    return null
  }

  const db = getDb()
  const normalizedName = recordName.trim().toLowerCase().replace(/\.$/, '')
  let fullHost: string
  if (normalizedName === '@' || normalizedName === '' || normalizedName === zoneName.toLowerCase()) {
    fullHost = zoneName.toLowerCase()
  } else if (normalizedName.endsWith(`.${zoneName.toLowerCase()}`)) {
    fullHost = normalizedName
  } else {
    fullHost = `${normalizedName}.${zoneName}`.toLowerCase()
  }

  const redirects = await db
    .select({ host: windowsDnsRedirects.host })
    .from(windowsDnsRedirects)
    .where(
      and(
        eq(windowsDnsRedirects.organizationId, orgId),
        eq(windowsDnsRedirects.zoneId, zoneId)
      )
    )

  for (const redirect of redirects) {
    if (redirect.host.toLowerCase() === fullHost) {
      return redirect.host
    }
  }

  return null
}

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const zoneId = getRouterParam(event, 'zoneId')
  const recordId = getRouterParam(event, 'recordId')

  if (!zoneId || !recordId) {
    throw createError({ statusCode: 400, message: 'zoneId and recordId are required.' })
  }

  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canEditRecords) {
    throw createError({ statusCode: 403, message: 'Du har inte behörighet att uppdatera DNS-poster.' })
  }

  const body = await readBody<{
    type?: string
    name?: string
    content?: string
    ttl?: number | null
    priority?: number | null
    comment?: string | null
  }>(event)

  // Validate comment length if provided
  if (body?.comment !== undefined && body.comment !== null) {
    const trimmedComment = body.comment.trim()
    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      throw createError({
        statusCode: 400,
        message: `Kommentaren får max vara ${MAX_COMMENT_LENGTH} tecken.`
      })
    }
    body.comment = trimmedComment || null
  }

  // Block SOA record updates - SOA is managed via Zone settings
  // If type is provided, check it directly
  if (body?.type !== undefined) {
    assertNotSoa(body.type)
  }

  // Normalize TXT content: strip surrounding double quotes (Windows DNS rejects them)
  // UI sends type with every PATCH now; if missing, we still normalize content defensively
  if (body?.content !== undefined) {
    const isTxt = body?.type !== undefined
      ? String(body.type).toUpperCase() === 'TXT'
      : false // fallback: don't normalize if type unknown (safe default)
    if (isTxt) {
      const normalized = normalizeTxtContent(body.content)
      console.log(`[windows-dns] Normalized TXT content for zoneId=${zoneId}, recordId=${recordId}`)
      if (!normalized) {
        throw createError({
          statusCode: 400,
          message: 'TXT-värdet får inte vara tomt.'
        })
      }
      body.content = normalized
    }
  }

  try {
    const client = await getClientForOrg(orgId)
    const db = getDb()

    // Get zone name for conflict checking
    const [allowedZone] = await db
      .select({ zoneName: windowsDnsAllowedZones.zoneName })
      .from(windowsDnsAllowedZones)
      .where(
        and(
          eq(windowsDnsAllowedZones.organizationId, orgId),
          eq(windowsDnsAllowedZones.zoneId, zoneId)
        )
      )
      .limit(1)

    const zoneName = allowedZone?.zoneName || ''

    // Always fetch existing record for SOA check and audit diff (before state)
    const records = await client.listRecordsForZone(zoneId)
    assertRecordNotSoa(recordId, records)
    const existingRecord = records.find((r: any) => r.id === recordId) as Record<string, unknown> | undefined
    
    // If record not found, throw early
    if (!existingRecord) {
      throw createError({
        statusCode: 404,
        message: 'DNS-posten hittades inte. Den kan ha tagits bort.'
      })
    }

    // Guard: Block modification of reserved _coreid marker record
    if (existingRecord?.name && isCoreIdMarkerRecord(existingRecord.name, zoneName)) {
      throw createError({
        statusCode: 403,
        message: 'Kan inte ändra _coreid-markörposten. Denna post hanteras av systemet.'
      })
    }
    // Also block if trying to rename something TO _coreid
    if (body?.name !== undefined && isCoreIdMarkerRecord(body.name, zoneName)) {
      throw createError({
        statusCode: 403,
        message: 'Kan inte döpa om en post till _coreid. Detta namn är reserverat för systemet.'
      })
    }

    // Check for redirect conflicts if name is being changed
    if (zoneName && body?.name !== undefined) {
      const effectiveType = body?.type ?? existingRecord?.type ?? ''
      const conflictingHost = await checkRedirectConflict(orgId, zoneId, zoneName, body.name, effectiveType)
      if (conflictingHost) {
        throw createError({
          statusCode: 409,
          message: `Det finns redan en omdirigering för "${conflictingHost}". Ta bort omdirigeringen först eller hantera DNS-poster via omdirigeringshanteraren.`,
          data: {
            code: 'REDIRECT_CONFLICT',
            host: conflictingHost
          }
        })
      }
    }
    
    // Build update payload with only provided fields
    const updates: Record<string, unknown> = {}
    if (body?.type !== undefined) updates.type = body.type
    if (body?.name !== undefined) updates.name = body.name
    if (body?.content !== undefined) updates.content = body.content
    if (body?.ttl !== undefined) updates.ttl = body.ttl
    if (body?.priority !== undefined) updates.priority = body.priority
    if (body?.comment !== undefined) updates.comment = body.comment

    const record = await client.updateRecord(zoneId, recordId, updates)

    // Build changes diff and log audit event only if there are actual changes
    const { changes } = buildChanges(
      existingRecord,
      record as Record<string, unknown>,
      { entityType: 'windows_dns_record' }
    )
    
    if (hasChanges(changes)) {
      const auditMeta = buildDnsRecordAuditMeta({
        moduleKey: 'windows-dns',
        entityType: 'windows_dns_record',
        entityId: recordId,
        zoneId,
        zoneName,
        recordType: record.type,
        recordName: record.name,
        operation: 'update',
        before: existingRecord,
        after: record as Record<string, unknown>
      })
      await logAuditEvent(event, 'WINDOWS_DNS_RECORD_UPDATED', auditMeta)
    }

    return { record }
  } catch (error: any) {
    const errorMessage = error?.message ?? 'Failed to update record.'

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      throw createError({
        statusCode: 404,
        message: 'DNS-posten hittades inte. Den kan ha tagits bort.'
      })
    }

    if (errorMessage.includes('already exists') || errorMessage.includes('409')) {
      throw createError({
        statusCode: 409,
        message: 'En DNS-post med samma typ, namn och innehåll finns redan.'
      })
    }

    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: errorMessage
    })
  }
})

