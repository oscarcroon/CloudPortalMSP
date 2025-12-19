import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getMaskedOrgConfig } from '@windows-dns/server/lib/windows-dns/org-config'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canManageOrgConfig) {
    throw createError({ statusCode: 403, message: 'No permission to view Windows DNS configuration.' })
  }

  const config = await getMaskedOrgConfig(orgId)

  return {
    config,
    configured: !!config?.coreId
  }
})

