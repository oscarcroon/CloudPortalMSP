import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getTenantModulesStatus } from '~~/server/utils/modulePolicy'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  await requireTenantPermission(event, 'tenants:manage', tenantId)

  const modules = await getTenantModulesStatus(tenantId)

  return {
    tenantId,
    modules
  }
})
