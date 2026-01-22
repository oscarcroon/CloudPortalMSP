import { defineEventHandler } from 'h3'
import { getGlobalEmailProviderSummary, resolveEmailProviderChain } from '~~/server/utils/emailProvider'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const [provider, chain] = await Promise.all([
    getGlobalEmailProviderSummary(),
    resolveEmailProviderChain()
  ])
  return { provider, chain }
})

