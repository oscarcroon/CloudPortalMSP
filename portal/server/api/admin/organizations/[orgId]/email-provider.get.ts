import { defineEventHandler } from 'h3'
import { getOrganizationEmailProviderSummary, resolveEmailProviderChain } from '~~/server/utils/emailProvider'
import { getDb } from '~~/server/utils/db'
import { requireSuperAdmin } from '~~/server/utils/rbac'
import { parseOrgParam, requireOrganizationByIdentifier } from '../utils'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  const [provider, chain] = await Promise.all([
    getOrganizationEmailProviderSummary(organization.id),
    resolveEmailProviderChain(organization.id)
  ])
  provider.disclaimerMarkdown = organization.emailDisclaimerMarkdown ?? null
  return { organization, provider, chain }
})

