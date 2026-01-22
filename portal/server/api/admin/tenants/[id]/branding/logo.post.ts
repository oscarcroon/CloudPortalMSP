import {
  createError,
  defineEventHandler,
  getQuery,
  getRouterParam,
  readMultipartFormData
} from 'h3'
import {
  setBrandingMediaAsset,
  type BrandingMediaType
} from '~~/server/utils/branding'
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

  const query = getQuery(event)
  const mediaType = resolveVariantMediaType(
    typeof query.variant === 'string' ? (query.variant as string) : null
  )
  const { url } = await setBrandingMediaAsset(
    {
      targetType: tenant.type,
      tenantId: tenant.id
    },
    mediaType,
    {
      filename: logoField.filename,
      mimeType: logoField.type,
      data: logoField.data
    },
    permission.auth.user.id
  )

  if (mediaType === 'appLogoLight') {
    return { logoUrl: url }
  }
  return { url, type: mediaType }
})

function resolveVariantMediaType(value: string | null): BrandingMediaType {
  switch ((value ?? '').toLowerCase()) {
    case 'app-dark':
    case 'app-logo-dark':
      return 'appLogoDark'
    case 'login-light':
    case 'login-logo-light':
      return 'loginLogoLight'
    case 'login-dark':
    case 'login-logo-dark':
      return 'loginLogoDark'
    case 'login-background':
      return 'loginBackground'
    default:
      return 'appLogoLight'
  }
}

