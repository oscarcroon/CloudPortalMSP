import { defineEventHandler } from 'h3'
import { getOrganisationEmailProviderSummary } from '~~/server/utils/emailProvider'
import { requirePermission } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const provider = await getOrganisationEmailProviderSummary(orgId)
  return { provider }
})

