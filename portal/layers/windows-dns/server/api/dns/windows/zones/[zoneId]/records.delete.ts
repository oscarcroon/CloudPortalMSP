import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { assertNotSoa } from '@windows-dns/server/utils/assert-not-soa'

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

  try {
    const client = await getClientForOrg(orgId)
    await client.deleteRecord(zoneId, {
      name: body.name,
      type: body.type,
      content: body.content
    })

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

