import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import {
  getCloudflareDnsModuleAccessForUser,
  getCloudflareDnsZoneAccessForUser
} from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getClientForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/client'

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
  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'Ingen behörighet att se Cloudflare-zoner.' })
  }

  const access = await getCloudflareDnsZoneAccessForUser(orgId, auth.user.id, orgRole, zoneId)
  if (!access.canView) {
    throw createError({ statusCode: 403, message: 'Saknar rättighet att se denna zon.' })
  }

  const client = await getClientForOrg(orgId)
  const zone = await client.getZone(zoneId)
  if (!zone) {
    throw createError({ statusCode: 404, message: 'Zonen kunde inte hittas i Cloudflare.' })
  }

  return {
    zone,
    access: {
      zoneRole: access.zoneRole,
      canEditRecords: access.canEditRecords,
      canExport: access.canExport,
      canImport: access.canImport,
      canManageZones: access.canManageZones,
      canManageAcls: access.canManageAcls
    },
    moduleRights: {
      canManageOrgConfig: moduleRights.canManageOrgConfig
    }
  }
})


