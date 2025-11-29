import { createError, defineEventHandler, getRouterParam, readMultipartFormData } from 'h3'
import { setBrandingLogo } from '~~/server/utils/branding'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { ensureBrandableTenant } from './utils'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const permission = await requireTenantPermission(event, 'tenants:manage', tenantId ?? undefined)
  const tenant = await ensureBrandableTenant(tenantId as string)

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'Logotypfil krävs.' })
  }

  const logoField = formData.find((field) => field.name === 'logo')
  if (!logoField || !logoField.filename) {
    throw createError({ statusCode: 400, message: 'Logotypfil krävs.' })
  }

  return setBrandingLogo(
    {
      targetType: tenant.type,
      tenantId: tenant.id
    },
    {
      filename: logoField.filename,
      mimeType: logoField.type,
      data: logoField.data
    },
    permission.auth.user.id
  )
})

