import { defineEventHandler } from 'h3'
import { getDb } from '~~/server/utils/db'
import {
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationReadAccess
} from '../../utils'
import {
  buildVerificationRecordName,
  buildVerificationRecordValue
} from '~~/server/utils/domain-verification'

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - requires tenants:read permission or super admin
  await requireOrganizationReadAccess(event, organization)
  
  const hasCustomDomain = Boolean(organization.customDomain)
  
  return {
    organizationId: organization.id,
    customDomain: organization.customDomain,
    customDomainVerificationStatus: organization.customDomainVerificationStatus,
    customDomainVerifiedAt: organization.customDomainVerifiedAt?.toISOString() ?? null,
    verificationInstructions: hasCustomDomain && organization.customDomainVerificationToken ? {
      recordType: 'TXT',
      recordName: buildVerificationRecordName(organization.customDomain!),
      recordValue: buildVerificationRecordValue(organization.customDomainVerificationToken),
      note: 'Lägg till denna TXT-post i din DNS för att verifiera domänägandeskap.'
    } : null
  }
})
