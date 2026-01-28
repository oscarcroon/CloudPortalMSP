import { defineEventHandler, getRouterParam } from 'h3'
import { deleteBrandingTheme, resolveBrandingChain } from '~~/server/utils/branding'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { ensureBrandableTenant } from './branding/utils'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  await requireTenantPermission(event, 'tenants:manage', tenantId ?? undefined)
  const tenant = await ensureBrandableTenant(tenantId as string)

  await deleteBrandingTheme({
    targetType: tenant.type,
    tenantId: tenant.id
  })

  return resolveBrandingChain({ tenantId: tenant.id })
})

