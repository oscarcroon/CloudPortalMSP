import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsZoneMemberships } from '~~/server/database/schema'
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

  if (!access.canManage) {
    throw createError({
      statusCode: 403,
      message: 'Saknar rättighet att hantera zon-åtkomst.'
    })
  }

  const db = getDb()
  const rows = await db
    .select()
    .from(windowsDnsZoneMemberships)
    .where(
      and(
        eq(windowsDnsZoneMemberships.organizationId, orgId),
        eq(windowsDnsZoneMemberships.zoneId, zoneId)
      )
    )

  return {
    entries: rows.map((row) => ({
      id: row.id,
      principalType: row.principalType,
      principalId: row.principalId,
      role: row.role
    }))
  }
})


