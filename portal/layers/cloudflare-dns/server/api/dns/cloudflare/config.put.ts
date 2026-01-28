import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsModuleAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { saveOrgConfig, updateValidationStatus } from '@cloudflare-dns/server/lib/cloudflare-dns/org-config'
import { CloudflareClient } from '@cloudflare-dns/server/lib/cloudflare-dns/client'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }

  const orgId = auth.currentOrgId
  const access = await getCloudflareDnsModuleAccessForUser(orgId, auth.user.id)
  if (!access.canManageOrgConfig) {
    throw createError({
      statusCode: 403,
      message: 'Saknar behörighet att hantera Cloudflare-konfiguration.'
    })
  }

  const body = await readBody<{ apiToken?: string; accountId?: string | null }>(event)
  if (!body?.apiToken || !body.apiToken.trim()) {
    throw createError({ statusCode: 400, message: 'apiToken är obligatoriskt.' })
  }

  const accountId = body.accountId ?? null
  const apiTokenTrimmed = body.apiToken.trim()
  const saved = await saveOrgConfig(orgId, { apiToken: apiTokenTrimmed, accountId })

  let lastValidatedAt: Date | null = null
  try {
    const client = new CloudflareClient(apiTokenTrimmed, accountId)
    await client.verifyToken()
    lastValidatedAt = new Date()
    await updateValidationStatus(orgId, {
      lastValidatedAt,
      lastSyncStatus: 'ok',
      lastSyncError: null
    })
  } catch (error: any) {
    const message =
      error?.data?.message ||
      error?.message ||
      'Kunde inte verifiera Cloudflare-token. Kontrollera behörigheter och försök igen.'

    await updateValidationStatus(orgId, {
      lastValidatedAt: null,
      lastSyncStatus: 'error',
      lastSyncError: message
    })

    throw createError({
      statusCode: 400,
      message
    })
  }

  // Audit log (do NOT log the actual token)
  await logAuditEvent(event, 'CLOUDFLARE_DNS_CONFIG_UPDATED', {
    moduleKey: 'cloudflare-dns',
    entityType: 'config',
    accountId: saved.accountId ?? null,
    tokenMasked: saved.tokenMasked,
    validated: !!lastValidatedAt
  })

  return {
    ok: true,
    accountId: saved.accountId,
    tokenMasked: saved.tokenMasked,
    lastValidatedAt
  }
})


