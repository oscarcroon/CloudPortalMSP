import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { organizationSsoDomains } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import {
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess
} from '../../utils'

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const domainParam = getRouterParam(event, 'domain')
  if (!domainParam) {
    throw createError({ statusCode: 400, message: 'Saknar domänparameter.' })
  }

  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  await requireOrganizationManageAccess(event, organization)

  const [ssoDomain] = await db
    .select({ id: organizationSsoDomains.id })
    .from(organizationSsoDomains)
    .where(
      and(
        eq(organizationSsoDomains.organizationId, organization.id),
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
