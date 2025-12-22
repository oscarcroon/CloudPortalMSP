import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { saveOrgConfig, getOrgCoreId } from '@windows-dns/server/lib/windows-dns/org-config'

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

  // CoreID is derived from organizations.core_id (source of truth)
  const coreId = await getOrgCoreId(orgId)
  if (!coreId) {
    throw createError({
      statusCode: 400,
      message: 'Organization must have a COREID set before enabling Windows DNS. Please configure COREID in organization settings.'
    })
  }

  const body = await readBody(event)

  // Save config (note: coreId is NOT saved here - it's derived from organizations.core_id)
  // Only instanceId and status fields are saved
  const config = await saveOrgConfig(orgId, {
    instanceId: body?.instanceId ?? null,
    lastValidatedAt: new Date()
  })

  return {
    config,
    configured: true
  }
})
