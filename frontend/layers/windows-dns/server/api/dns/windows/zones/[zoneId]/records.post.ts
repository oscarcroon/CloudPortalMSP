import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'

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
  if (!body?.name || !body?.type || !body?.content) {
    throw createError({
      statusCode: 400,
      message: 'Namn, typ och innehåll krävs.'
    })
  }

  try {
    const client = await getClientForOrg(orgId)

    // If this is an update, delete the old record first
    if (body.update && body.originalName && body.originalType) {
      try {
        await client.deleteRecord(zoneId, {
          name: body.originalName,
          type: body.originalType,
          content: body.originalContent
        })
      } catch (deleteErr: any) {
        // If old record doesn't exist, that's okay - continue with create
        const errMsg = deleteErr?.message ?? ''
        if (!errMsg.includes('not found') && !errMsg.includes('404')) {
          console.warn(`[windows-dns] Failed to delete old record during update: ${errMsg}`)
        }
      }
    }

    const record = await client.createRecord(zoneId, {
      name: body.name,
      type: body.type,
      content: body.content,
      ttl: body.ttl ?? 3600,
      priority: body.priority
    })

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

