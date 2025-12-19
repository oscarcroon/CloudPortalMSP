import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { saveOrgConfig } from '@windows-dns/server/lib/windows-dns/org-config'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canManageOrgConfig) {
    throw createError({ statusCode: 403, message: 'No permission to configure Windows DNS.' })
  }

  const body = await readBody(event)
  
  // coreId is required for Windows DNS integration
  if (!body?.coreId) {
    throw createError({
      statusCode: 400,
      message: 'coreId is required.'
    })
  }

  // Save config (note: baseUrl is now global via WINDOWS_DNS_API_URL env var)
  const config = await saveOrgConfig(orgId, {
    instanceId: body.instanceId ?? null,
    coreId: body.coreId,
    lastValidatedAt: new Date()
  })

  return {
    config,
    configured: true
  }
})
