import { defineEventHandler, getQuery, getRouterParam } from 'h3'
import {
  removeBrandingMediaAsset,
  type BrandingMediaType
} from '~~/server/utils/branding'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { ensureBrandableTenant } from './utils'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const permission = await requireTenantPermission(event, 'tenants:manage', tenantId ?? undefined)
  const tenant = await ensureBrandableTenant(tenantId as string)

  const query = getQuery(event)
  const mediaType = resolveVariantMediaType(
    typeof query.variant === 'string' ? (query.variant as string) : null
  )
  return removeBrandingMediaAsset(
    {
      targetType: tenant.type,
      tenantId: tenant.id
    },
    mediaType,
    permission.auth.user.id
  )
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
    case 'email':
    case 'email-logo':
      return 'emailLogo'
    default:
      return 'appLogoLight'
  }
}

