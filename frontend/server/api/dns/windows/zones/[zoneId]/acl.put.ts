import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { windowsDnsZoneMemberships } from '~~/server/database/schema'
import { getWindowsDnsZoneAccessForUser } from '~~/server/lib/windows-dns/windows-dns-zone-acl'
import { createId } from '@paralleldrive/cuid2'

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

  const body = await readBody<{
    entries: {
      principalType: 'user' | 'org-role'
      principalId: string
      role: 'viewer' | 'editor' | 'admin'
    }[]
  }>(event)

  const db = getDb()

  await db
    .delete(windowsDnsZoneMemberships)
    .where(
      and(
        eq(windowsDnsZoneMemberships.organizationId, orgId),
        eq(windowsDnsZoneMemberships.zoneId, zoneId)
      )
    )

  if (body?.entries?.length) {
    await db.insert(windowsDnsZoneMemberships).values(
      body.entries.map((entry) => ({
        id: createId(),
        organizationId: orgId,
        zoneId,
        principalType: entry.principalType,
        principalId: entry.principalId,
        role: entry.role,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    )
  }

  return { ok: true }
})


