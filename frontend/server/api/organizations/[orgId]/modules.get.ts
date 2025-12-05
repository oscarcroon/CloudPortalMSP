import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~~/server/utils/rbac'
import { getOrganizationModulesStatus } from '~~/server/utils/modulePolicy'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const modules = await getOrganizationModulesStatus(orgId)

  return {
    organizationId: orgId,
    modules
  }
})
