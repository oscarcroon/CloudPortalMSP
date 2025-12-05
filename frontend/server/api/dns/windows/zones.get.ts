import { createError, defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsZones } from '~~/server/database/schema'
import { getWindowsDnsZoneAccessForUser } from '~~/server/lib/windows-dns/windows-dns-zone-acl'
import { getWindowsDnsModuleAccessForUser } from '~~/server/lib/windows-dns/windows-dns-access'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }

  const orgId = auth.currentOrgId
  const orgRole = auth.orgRoles?.[orgId]

  const moduleAccess = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)
  if (!moduleAccess.hasAccess) {
    throw createError({ statusCode: 403, message: 'Ingen DNS-åtkomst.' })
  }

  const db = getDb()
  const zones = await db.select().from(windowsDnsZones).where(eq(windowsDnsZones.organizationId, orgId))

  const result = []
  for (const zone of zones) {
    const access = await getWindowsDnsZoneAccessForUser(orgId, auth.user.id, orgRole, zone.id)
    if (!access.canView) continue

    result.push({
      id: zone.id,
      name: zone.name,
      description: zone.description,
      effectiveRole: access.effectiveRole,
      canEdit: access.canEdit,
      canManage: access.canManage
    })
  }

  return { zones: result }
})


