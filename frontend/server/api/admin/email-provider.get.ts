import { defineEventHandler } from 'h3'
import { getGlobalEmailProviderSummary } from '~~/server/utils/emailProvider'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const provider = await getGlobalEmailProviderSummary()
  return { provider }
})

