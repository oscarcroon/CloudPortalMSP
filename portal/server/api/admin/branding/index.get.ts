import { defineEventHandler } from 'h3'
import { resolveGlobalBranding } from '~~/server/utils/branding'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  return resolveGlobalBranding()
})

