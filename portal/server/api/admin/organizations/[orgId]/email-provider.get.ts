import { defineEventHandler } from 'h3'
import { getOrganizationEmailProviderSummary, resolveEmailProviderChain } from '~~/server/utils/emailProvider'
import { getDb } from '~~/server/utils/db'
import { parseOrgParam, requireOrganizationByIdentifier, requireOrganizationReadAccess } from '../utils'

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - allows superadmins and tenant admins
  await requireOrganizationReadAccess(event, organization)
  const [provider, chain] = await Promise.all([
    getOrganizationEmailProviderSummary(organization.id),
    resolveEmailProviderChain(organization.id)
  ])
  provider.disclaimerMarkdown = organization.emailDisclaimerMarkdown ?? null
  return { organization, provider, chain }
})

