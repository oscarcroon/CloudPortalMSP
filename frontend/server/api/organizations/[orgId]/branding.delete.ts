import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteBrandingTheme, resolveBrandingChain } from '~~/server/utils/branding'
import { requirePermission } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const paramOrgId = getRouterParam(event, 'orgId')
  if (paramOrgId !== orgId) {
    throw createError({
      statusCode: 403,
      message: 'Kan inte återställa branding för denna organisation.'
    })
  }

  await deleteBrandingTheme({ targetType: 'organization', organizationId: orgId })
  return resolveBrandingChain({ organizationId: orgId })
})

