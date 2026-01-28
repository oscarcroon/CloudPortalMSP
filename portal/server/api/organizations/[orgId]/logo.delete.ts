import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import {
  removeBrandingMediaAsset,
  type BrandingMediaType
} from '~~/server/utils/branding'
import { requirePermission } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const { orgId, auth } = await requirePermission(event, 'org:manage')
  const paramOrgId = getRouterParam(event, 'orgId')
  if (paramOrgId !== orgId) {
    throw createError({ statusCode: 403, message: 'Kan inte ta bort logotyp för denna organisation.' })
  }

  const query = getQuery(event)
  const mediaType = resolveVariantMediaType(
    typeof query.variant === 'string' ? (query.variant as string) : null
  )
  return removeBrandingMediaAsset(
    { targetType: 'organization', organizationId: orgId },
    mediaType,
    auth.user.id
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

