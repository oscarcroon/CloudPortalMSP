import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsZoneAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { replaceZoneAcl, type CloudflareZoneAclEntry } from '@cloudflare-dns/server/lib/cloudflare-dns/zone-acl'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId
  const orgRole = auth.orgRoles?.[orgId]
  const zoneId = getRouterParam(event, 'zoneId')

  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'zoneId saknas.' })
  }

  const access = await getCloudflareDnsZoneAccessForUser(orgId, auth.user.id, orgRole, zoneId)
  if (!access.canManageAcls) {
    throw createError({ statusCode: 403, message: 'Saknar rättighet att hantera ACL för zonen.' })
  }

  const body = await readBody<{ entries: CloudflareZoneAclEntry[] }>(event)
  const entries = body?.entries ?? []

  for (const entry of entries) {
    if (!entry.principalId || !entry.principalType || !entry.role) {
      throw createError({ statusCode: 400, message: 'Ogiltig ACL-post.' })
    }
  }

  await replaceZoneAcl(orgId, zoneId, entries)

  return { ok: true }
})


