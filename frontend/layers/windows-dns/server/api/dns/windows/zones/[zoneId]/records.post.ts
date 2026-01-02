import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'

const MAX_COMMENT_LENGTH = 2000

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
    throw createError({ statusCode: 403, message: 'Du har inte behörighet att hantera DNS-poster.' })
  }

  const body = await readBody(event)

  // Reject legacy update requests - clients should use PATCH endpoint
  if (body?.update) {
    throw createError({
      statusCode: 409,
      message: 'Update via POST is deprecated. Use PATCH /zones/:zoneId/records/:recordId instead.'
    })
  }

  if (!body?.name || !body?.type || !body?.content) {
    throw createError({
      statusCode: 400,
      message: 'Namn, typ och innehåll krävs.'
    })
  }

  // Validate and normalize comment
  let comment: string | undefined = undefined
  if (body.comment !== undefined && body.comment !== null && String(body.comment).trim()) {
    const trimmedComment = String(body.comment).trim()
    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      throw createError({
        statusCode: 400,
        message: `Kommentaren får max vara ${MAX_COMMENT_LENGTH} tecken.`
      })
    }
    comment = trimmedComment
  }

  try {
    const client = await getClientForOrg(orgId)

    const recordPayload: any = {
      name: body.name,
      type: body.type,
      content: body.content,
      ttl: body.ttl ?? 3600
    }
    if (body.priority !== undefined) {
      recordPayload.priority = body.priority
    }
    if (comment !== undefined) {
      recordPayload.comment = comment
    }

    const record = await client.createRecord(zoneId, recordPayload)

    return { record }
  } catch (error: any) {
    // Parse error message for better UX
    const errorMessage = error?.message ?? 'Failed to create record.'
    
    // Provide user-friendly error messages
    if (errorMessage.includes('already exists') || errorMessage.includes('409')) {
      throw createError({
        statusCode: 409,
        message: `En DNS-post av typen ${body.type} med namnet "${body.name}" finns redan. Ta bort den befintliga posten först eller välj ett annat namn.`
      })
    }
    
    if (errorMessage.includes('Failed to create resource record')) {
      throw createError({
        statusCode: 400,
        message: `Kunde inte skapa DNS-posten. Kontrollera att värdet "${body.content}" är giltigt för posttypen ${body.type}.`
      })
    }

    if (errorMessage.includes('Zone not found') || errorMessage.includes('404')) {
      throw createError({
        statusCode: 404,
        message: 'Zonen hittades inte. Den kan ha tagits bort.'
      })
    }
    
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: errorMessage
    })
  }
})

