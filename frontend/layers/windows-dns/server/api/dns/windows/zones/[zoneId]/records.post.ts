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
    throw createError({ statusCode: 403, message: 'No permission to create DNS records.' })
  }

  const body = await readBody(event)
  if (!body?.name || !body?.type || !body?.content) {
    throw createError({
      statusCode: 400,
      message: 'name, type, and content are required.'
    })
  }

  try {
    const client = await getClientForOrg(orgId)
    const record = await client.createRecord(zoneId, {
      name: body.name,
      type: body.type,
      content: body.content,
      ttl: body.ttl ?? 3600,
      priority: body.priority
    })

    return { record }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to create record.'
    })
  }
})

