import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsZoneAccessForUser } from '~~/server/lib/windows-dns/windows-dns-zone-acl'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }

  const orgId = auth.currentOrgId
  const zoneId = getRouterParam(event, 'zoneId')
  const orgRole = auth.orgRoles?.[orgId]

  if (!zoneId) {
    throw createError({ statusCode: 400, message: 'ZoneId saknas.' })
  }

  const access = await getWindowsDnsZoneAccessForUser(orgId, auth.user.id, orgRole, zoneId)

  if (!access.canEdit) {
    throw createError({
      statusCode: 403,
      message: 'Saknar rättighet att ändra records i denna zon.'
    })
  }

  const body = await readBody(event)
  // TODO: implement actual record update towards Windows DNS backend
  void body

  return { ok: true }
})


