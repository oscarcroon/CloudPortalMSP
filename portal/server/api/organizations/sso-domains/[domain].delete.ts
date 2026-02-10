import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { organizationSsoDomains } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const domainParam = getRouterParam(event, 'domain')
  if (!domainParam) {
    throw createError({ statusCode: 400, message: 'Saknar domänparameter.' })
  }

  const db = getDb()

  const [ssoDomain] = await db
    .select({ id: organizationSsoDomains.id })
    .from(organizationSsoDomains)
    .where(
      and(
        eq(organizationSsoDomains.organizationId, orgId),
        eq(organizationSsoDomains.domain, domainParam)
      )
    )
    .limit(1)

  if (!ssoDomain) {
    throw createError({ statusCode: 404, message: 'SSO-domänen hittades inte.' })
  }

  await db
    .delete(organizationSsoDomains)
    .where(eq(organizationSsoDomains.id, ssoDomain.id))

  return { success: true }
})
