import { defineEventHandler } from 'h3'
import {
  resolveBrandingChain,
  resolveGlobalBranding
} from '~~/server/utils/branding'
import { resolveLoginBrandingContext } from '~~/server/utils/loginBrandingResolver'

export default defineEventHandler(async (event) => {
  const context = await resolveLoginBrandingContext(event)

  if (context.organizationId) {
    return resolveBrandingChain({ organizationId: context.organizationId })
  }
  if (context.tenantId) {
    return resolveBrandingChain({ tenantId: context.tenantId })
  }

  return resolveGlobalBranding()
})

