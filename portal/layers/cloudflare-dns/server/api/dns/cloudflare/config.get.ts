import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsModuleAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getMaskedOrgConfig } from '@cloudflare-dns/server/lib/cloudflare-dns/org-config'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }

  const orgId = auth.currentOrgId
  const access = await getCloudflareDnsModuleAccessForUser(orgId, auth.user.id)
  if (!access.canManageApi) {
    throw createError({
      statusCode: 403,
      message: 'Saknar behörighet att hantera Cloudflare-konfiguration.'
    })
  }

  const config = await getMaskedOrgConfig(orgId)

  return {
    config: config ?? {
      accountId: null,
      tokenMasked: '',
      lastValidatedAt: null,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null
    }
  }
})


