import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { tenants } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireTenantPermission } from '~~/server/utils/rbac'
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
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant-id krävs.' })
  }

  await requireTenantPermission(event, 'tenants:manage', tenantId)

  const db = getDb()
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      type: tenants.type,
      slug: tenants.slug,
      customDomain: tenants.customDomain,
      customDomainVerificationStatus: tenants.customDomainVerificationStatus,
      customDomainVerifiedAt: tenants.customDomainVerifiedAt,
      customDomainVerificationToken: tenants.customDomainVerificationToken
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const tenant = rows[0]
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  const hasCustomDomain = Boolean(tenant.customDomain)
  const cnameTarget = buildCnameTarget(tenant.slug)

  return {
    tenantId: tenant.id,
    name: tenant.name,
    type: tenant.type,
    slug: tenant.slug,
    customDomain: tenant.customDomain,
    customDomainVerificationStatus: tenant.customDomainVerificationStatus ?? 'unverified',
    customDomainVerifiedAt: tenant.customDomainVerifiedAt
      ? new Date(tenant.customDomainVerifiedAt).toISOString()
      : null,
    // CNAME target for custom domain setup
    cnameTarget,
    defaultDomain: `https://${cnameTarget}`,
    verificationInstructions:
      hasCustomDomain && tenant.customDomainVerificationToken
        ? {
            recordType: 'TXT',
            recordName: buildVerificationRecordName(tenant.customDomain!),
            recordValue: buildVerificationRecordValue(tenant.customDomainVerificationToken),
            note: 'Lägg till denna TXT-post i din DNS för att verifiera domänägandeskap.'
          }
        : null
  }
})
