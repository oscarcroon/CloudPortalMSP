import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { normalizeTxtContent } from '@windows-dns/lib/normalize-txt'
import { assertNotSoa, assertRecordNotSoa, isSoaType } from '@windows-dns/server/utils/assert-not-soa'

const MAX_COMMENT_LENGTH = 2000

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

    // If type was not provided, look up the record to check if it's SOA
    // This ensures SOA cannot be updated even if type is omitted from the request
    if (body?.type === undefined) {
      const records = await client.listRecordsForZone(zoneId)
      assertRecordNotSoa(recordId, records)
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

