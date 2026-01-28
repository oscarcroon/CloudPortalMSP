import { createError, defineEventHandler, getRouterParam } from 'h3'
import { resolveBrandingChain } from '~~/server/utils/branding'
import { requirePermission } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const paramOrgId = getRouterParam(event, 'orgId')
  if (paramOrgId !== orgId) {
    throw createError({
      statusCode: 403,
      message: 'Kan inte visa branding för denna organisation.'
    })
  }

  return resolveBrandingChain({ organizationId: orgId })
})

