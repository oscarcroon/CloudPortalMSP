import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsModuleAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { CloudflareClient } from '@cloudflare-dns/server/lib/cloudflare-dns/client'
import { getOrgConfig, updateValidationStatus } from '@cloudflare-dns/server/lib/cloudflare-dns/org-config'

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

  const body = await readBody<{ apiToken?: string; accountId?: string | null }>(event)
  const stored = await getOrgConfig(orgId)
  const apiToken = body?.apiToken ?? stored?.apiToken
  const accountId = body?.accountId ?? stored?.accountId ?? null

  if (!apiToken) {
    throw createError({ statusCode: 400, message: 'Ingen Cloudflare-token är konfigurerad.' })
  }

  try {
    const client = new CloudflareClient(apiToken, accountId)
    await client.verifyToken()
    const now = new Date()
    await updateValidationStatus(orgId, { lastValidatedAt: now, lastSyncStatus: 'ok', lastSyncError: null })
    return { ok: true, lastValidatedAt: now }
  } catch (error: any) {
    const message = error?.message ?? 'Tokenvalidering misslyckades.'
    await updateValidationStatus(orgId, { lastValidatedAt: null, lastSyncStatus: 'error', lastSyncError: message })
    throw createError({ statusCode: 400, message })
  }
})


