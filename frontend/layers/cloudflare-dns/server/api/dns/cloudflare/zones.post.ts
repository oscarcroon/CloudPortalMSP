import { createError, defineEventHandler, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsModuleAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getClientForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/client'
import { upsertZoneCache } from '@cloudflare-dns/server/lib/cloudflare-dns/org-config'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId

  const moduleRights = await getCloudflareDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canManageZones) {
    throw createError({ statusCode: 403, message: 'Saknar rättighet att skapa zoner.' })
  }

  const body = await readBody<{ name?: string; accountId?: string | null; jumpStart?: boolean }>(event)
  if (!body?.name || !body.name.trim()) {
    throw createError({ statusCode: 400, message: 'Zon-namn saknas.' })
  }

  const client = await getClientForOrg(orgId)
  const zone = await client.createZone({
    name: body.name.trim(),
    accountId: body.accountId ?? null,
    jumpStart: body.jumpStart ?? false
  })

  await upsertZoneCache(orgId, [
    { id: zone.id, name: zone.name, status: zone.status ?? null, plan: zone.plan ?? null }
  ])

  return { zone }
})


