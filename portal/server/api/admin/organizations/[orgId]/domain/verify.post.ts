import { createError, defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { organizations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { logOrganizationAction } from '~~/server/utils/audit'
import { rateLimiters } from '~~/server/utils/rateLimit'
import {
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess
} from '../../utils'
import {
  verifyDomainOwnership,
  buildVerificationRecordName,
  buildVerificationRecordValue
} from '~~/server/utils/domain-verification'

export default defineEventHandler(async (event) => {
  // Apply rate limiting for domain verification
  await rateLimiters.domainVerification(event)
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - requires tenants:manage permission or super admin
  await requireOrganizationManageAccess(event, organization)
  
  // Check that a domain is configured
  if (!organization.customDomain) {
    throw createError({
      statusCode: 400,
      message: 'Ingen custom domain är konfigurerad för denna organisation.'
    })
  }
  
  // Check that there's a verification token
  if (!organization.customDomainVerificationToken) {
    throw createError({
      statusCode: 400,
      message: 'Ingen verifieringstoken finns. Konfigurera om domänen för att generera en ny token.'
    })
  }
  
  // Already verified?
  if (organization.customDomainVerificationStatus === 'verified') {
    return {
      organizationId: organization.id,
      customDomain: organization.customDomain,
      customDomainVerificationStatus: 'verified',
      customDomainVerifiedAt: organization.customDomainVerifiedAt?.toISOString() ?? null,
      message: 'Domänen är redan verifierad.'
    }
  }
  
  // Update status to verifying
  await db
    .update(organizations)
    .set({
      customDomainVerificationStatus: 'verifying',
      updatedAt: new Date()
    })
    .where(eq(organizations.id, organization.id))
  
  // Perform DNS verification
  const result = await verifyDomainOwnership(
    organization.customDomain,
    organization.customDomainVerificationToken
  )
  
  if (result.verified) {
    const verifiedAt = new Date()
    await db
      .update(organizations)
      .set({
        customDomainVerificationStatus: 'verified',
        customDomainVerifiedAt: verifiedAt,
        updatedAt: verifiedAt
      })
      .where(eq(organizations.id, organization.id))
    
    // Log audit event
    await logOrganizationAction(event, 'ORGANIZATION_CUSTOM_DOMAIN_VERIFIED', {
      customDomain: organization.customDomain,
      verifiedAt: verifiedAt.toISOString()
    }, organization.id)
    
    return {
      organizationId: organization.id,
      customDomain: organization.customDomain,
      customDomainVerificationStatus: 'verified',
      customDomainVerifiedAt: verifiedAt.toISOString(),
      message: 'Domänen har verifierats!'
    }
  } else {
    // Verification failed - update status back to pending
    await db
      .update(organizations)
      .set({
        customDomainVerificationStatus: 'pending',
        updatedAt: new Date()
      })
      .where(eq(organizations.id, organization.id))
    
    return {
      organizationId: organization.id,
      customDomain: organization.customDomain,
      customDomainVerificationStatus: 'pending',
      customDomainVerifiedAt: null,
      verified: false,
      error: result.error,
      foundRecords: result.foundRecords,
      expected: {
        recordName: buildVerificationRecordName(organization.customDomain),
        recordValue: buildVerificationRecordValue(organization.customDomainVerificationToken)
      },
      message: 'Verifiering misslyckades. Kontrollera att DNS TXT-posten är korrekt konfigurerad.'
    }
  }
})
