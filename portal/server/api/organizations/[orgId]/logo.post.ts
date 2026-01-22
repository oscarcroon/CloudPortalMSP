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
import { requirePermission } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const { orgId, auth } = await requirePermission(event, 'org:manage')
  const paramOrgId = getRouterParam(event, 'orgId')
  if (paramOrgId !== orgId) {
    throw createError({ statusCode: 403, message: 'Kan inte ladda upp logotyp för denna organisation.' })
  }

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
    { targetType: 'organization', organizationId: orgId },
    mediaType,
    {
      filename: logoField.filename,
      mimeType: logoField.type,
      data: logoField.data
    },
    auth.user.id
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
