import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import {
  getCloudflareDnsModuleAccessForUser,
  getCloudflareDnsZoneAccessForUser
} from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getClientForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/client'
import { clearZoneCacheForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/org-config'
import { logAuditEvent } from '~~/server/utils/audit'

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

  const moduleRights = await getCloudflareDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleRights.canManageZones) {
    throw createError({ statusCode: 403, message: 'Saknar rättighet att hantera zoner.' })
  }

  const zoneAccess = await getCloudflareDnsZoneAccessForUser(orgId, auth.user.id, orgRole, zoneId)
  if (!zoneAccess.canManageZones) {
    throw createError({ statusCode: 403, message: 'Saknar rättighet att ta bort zonen.' })
  }

  const client = await getClientForOrg(orgId)
  await client.deleteZone(zoneId)

  await clearZoneCacheForOrg(orgId)

  // Audit log
  await logAuditEvent(event, 'CLOUDFLARE_DNS_ZONE_DELETED', {
    moduleKey: 'cloudflare-dns',
    entityType: 'zone',
    entityId: zoneId
  })

  return { ok: true }
})


