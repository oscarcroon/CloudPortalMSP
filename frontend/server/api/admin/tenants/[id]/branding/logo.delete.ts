import { defineEventHandler, getRouterParam } from 'h3'
import { removeBrandingLogo } from '~~/server/utils/branding'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { ensureBrandableTenant } from './utils'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const permission = await requireTenantPermission(event, 'tenants:manage', tenantId ?? undefined)
  const tenant = await ensureBrandableTenant(tenantId as string)

  await removeBrandingLogo(
    {
      targetType: tenant.type,
      tenantId: tenant.id
    },
    permission.auth.user.id
  )

  return { success: true }
})

