import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsModuleAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { deleteOrgConfig } from '@cloudflare-dns/server/lib/cloudflare-dns/org-config'
import { logAuditEvent } from '~~/server/utils/audit'

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

  await deleteOrgConfig(orgId)

  await logAuditEvent(event, 'CLOUDFLARE_DNS_CONFIG_DELETED', {
    moduleKey: 'cloudflare-dns',
    entityType: 'config'
  })

  return {
    ok: true
  }
})
