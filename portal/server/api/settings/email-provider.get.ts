import { createError, defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { organizations } from '~~/server/database/schema'
import { getOrganizationEmailProviderSummary } from '~~/server/utils/emailProvider'
import { getDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const db = getDb()
  const [organization] = await db
    .select({ id: organizations.id, emailDisclaimerMarkdown: organizations.emailDisclaimerMarkdown })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organisationen kunde inte hittas.' })
  }

  const provider = await getOrganizationEmailProviderSummary(orgId)
  provider.disclaimerMarkdown = organization.emailDisclaimerMarkdown ?? null
  return { provider }
})

