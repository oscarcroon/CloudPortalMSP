import { createError, defineEventHandler, getRouterParam } from 'h3'
import { removeBrandingLogo } from '~~/server/utils/branding'
import { requirePermission } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  const { orgId, auth } = await requirePermission(event, 'org:manage')
  const paramOrgId = getRouterParam(event, 'orgId')
  if (paramOrgId !== orgId) {
    throw createError({ statusCode: 403, message: 'Kan inte ta bort logotyp för denna organisation.' })
  }

  await removeBrandingLogo(
    { targetType: 'organization', organizationId: orgId },
    auth.user.id
  )

  return { success: true }
})

