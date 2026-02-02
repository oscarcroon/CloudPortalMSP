import { defineEventHandler, getRouterParam } from 'h3'
import { resolveBrandingChain } from '~~/server/utils/branding'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { ensureBrandableTenant } from './branding/utils'
import {
  buildVerificationRecordName,
  buildVerificationRecordValue
} from '~~/server/utils/domain-verification'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  await requireTenantPermission(event, 'tenants:manage', tenantId ?? undefined)
  const tenant = await ensureBrandableTenant(tenantId as string)
  const branding = await resolveBrandingChain({ tenantId: tenant.id })

  // Build verification instructions if domain is set but not verified
  const hasUnverifiedDomain =
    tenant.customDomain &&
    tenant.customDomainVerificationStatus !== 'verified' &&
    tenant.customDomainVerificationToken

  const verificationInstructions = hasUnverifiedDomain
    ? {
        recordType: 'TXT',
        recordName: buildVerificationRecordName(tenant.customDomain!),
        recordValue: buildVerificationRecordValue(tenant.customDomainVerificationToken!),
        note: 'Lägg till denna TXT-post i din DNS för att verifiera domänägandeskap.'
      }
    : null

  return {
    branding,
    tenant: {
      ...tenant,
      verificationInstructions
    }
  }
})

