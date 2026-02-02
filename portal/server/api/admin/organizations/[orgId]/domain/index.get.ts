import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { tenants } from '~~/server/database/schema'
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

/**
 * Build CNAME target from slug using configured suffix
 */
function buildCnameTarget(slug: string): string {
  const config = useRuntimeConfig()
  const suffixes = config.loginBranding?.slugSuffixes as string[] | undefined
  // Default to .portal.coreit.cloud, remove leading dot for CNAME target
  const suffix = (suffixes?.[0] || '.portal.coreit.cloud').replace(/^\./, '')
  return `${slug}.${suffix}`
}

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - requires tenants:read permission or super admin
  await requireOrganizationReadAccess(event, organization)
  
  const hasCustomDomain = Boolean(organization.customDomain)
  
  // Get tenant slug if organization belongs to a tenant (for CNAME target)
  let tenantSlug: string | null = null
  if (organization.tenantId) {
    const [tenant] = await db
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, organization.tenantId))
      .limit(1)
    tenantSlug = tenant?.slug ?? null
  }
  
  // Use organization slug for CNAME target, or tenant slug as fallback
  const slugForCname = organization.slug || tenantSlug
  const cnameTarget = slugForCname ? buildCnameTarget(slugForCname) : null
  
  return {
    organizationId: organization.id,
    name: organization.name,
    slug: organization.slug,
    customDomain: organization.customDomain,
    customDomainVerificationStatus: organization.customDomainVerificationStatus,
    customDomainVerifiedAt: organization.customDomainVerifiedAt?.toISOString() ?? null,
    // CNAME target for custom domain setup
    cnameTarget,
    defaultDomain: cnameTarget ? `https://${cnameTarget}` : null,
    // Tenant info for context
    tenantId: organization.tenantId,
    tenantSlug,
    verificationInstructions: hasCustomDomain && organization.customDomainVerificationToken ? {
      recordType: 'TXT',
      recordName: buildVerificationRecordName(organization.customDomain!),
      recordValue: buildVerificationRecordValue(organization.customDomainVerificationToken),
      note: 'Lägg till denna TXT-post i din DNS för att verifiera domänägandeskap.'
    } : null
  }
})
