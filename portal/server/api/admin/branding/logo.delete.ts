import { createError, defineEventHandler, getQuery } from 'h3'
import {
  removeBrandingMediaAsset,
  type BrandingMediaType
} from '~~/server/utils/branding'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const auth = await requireSuperAdmin(event)

  const query = getQuery(event)
  const mediaType = resolveVariantMediaType(
    typeof query.variant === 'string' ? (query.variant as string) : null
  )

  const result = await removeBrandingMediaAsset(
    { targetType: 'global' },
    mediaType,
    auth.user.id
  )

  if (!result.removed) {
    throw createError({ statusCode: 404, message: 'Ingen media att ta bort.' })
  }

  return result
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

