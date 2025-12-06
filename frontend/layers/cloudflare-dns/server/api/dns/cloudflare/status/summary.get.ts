import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsModuleAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getMaskedOrgConfig, getZoneCacheSummary } from '@cloudflare-dns/server/lib/cloudflare-dns/org-config'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }

  const orgId = auth.currentOrgId
  const access = await getCloudflareDnsModuleAccessForUser(orgId, auth.user.id)
  if (!access.canView) {
    throw createError({ statusCode: 403, message: 'Ingen behörighet att se Cloudflare-status.' })
  }

  const summary = await getZoneCacheSummary(orgId)
  const masked = await getMaskedOrgConfig(orgId)

  return {
    zones: summary.zones,
    lastSyncAt: masked?.lastSyncAt ?? summary.lastSyncAt ?? null,
    lastSyncStatus: masked?.lastSyncStatus ?? null,
    lastSyncError: masked?.lastSyncError ?? null,
    lastValidatedAt: masked?.lastValidatedAt ?? null
  }
})


