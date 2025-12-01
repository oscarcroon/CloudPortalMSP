import { createError } from 'h3'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from './db'
import { distributorProviders, organizations, tenants } from '../database/schema'

type TenantType = 'provider' | 'distributor' | 'organization'

export interface TenantAuditScope {
  tenantId: string
  tenantType: TenantType
  selfTenantIds: string[]
  providerTenantIds: string[]
  orgIds: string[]
}

interface TenantSummary {
  id: string
  type: TenantType
  parentTenantId: string | null
}

export const fetchTenantSummary = async (tenantId: string): Promise<TenantSummary | undefined> => {
  const db = getDb()
  const [tenant] = await db
    .select({
      id: tenants.id,
      type: tenants.type,
      parentTenantId: tenants.parentTenantId
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  return tenant as TenantSummary | undefined
}

export const fetchDistributorProviderIds = async (tenantId: string): Promise<string[]> => {
  const db = getDb()
  const providerIds = new Set<string>()

  const linkedProviders = await db
    .select({
      providerId: distributorProviders.providerId
    })
    .from(distributorProviders)
    .where(eq(distributorProviders.distributorId, tenantId))

  for (const link of linkedProviders) {
    if (link.providerId) {
      providerIds.add(link.providerId)
    }
  }

  const legacyProviders = await db
    .select({
      id: tenants.id
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.parentTenantId, tenantId),
        eq(tenants.type, 'provider')
      )
    )

  for (const legacy of legacyProviders) {
    if (legacy.id) {
      providerIds.add(legacy.id)
    }
  }

  return Array.from(providerIds)
}

export const fetchOrganizationIds = async (tenantIds: string[]): Promise<string[]> => {
  if (tenantIds.length === 0) {
    return []
  }

  const db = getDb()
  const orgs = await db
    .select({
      id: organizations.id
    })
    .from(organizations)
    .where(inArray(organizations.tenantId, tenantIds))

  return orgs.map(org => org.id).filter(Boolean) as string[]
}

interface TenantAuditScopeDeps {
  fetchTenant?: typeof fetchTenantSummary
  fetchProviders?: typeof fetchDistributorProviderIds
  fetchOrganizations?: typeof fetchOrganizationIds
}

export const getTenantAuditScope = async (
  tenantId: string,
  deps: TenantAuditScopeDeps = {}
): Promise<TenantAuditScope> => {
  const tenantFetcher = deps.fetchTenant ?? fetchTenantSummary
  const providerFetcher = deps.fetchProviders ?? fetchDistributorProviderIds
  const organizationFetcher = deps.fetchOrganizations ?? fetchOrganizationIds

  const tenant = await tenantFetcher(tenantId)

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const providerTenantIds =
    tenant.type === 'distributor' ? await providerFetcher(tenantId) : []

  const aggregateTenantIds = [tenantId, ...providerTenantIds]
  const orgIds = await organizationFetcher(aggregateTenantIds)

  return {
    tenantId,
    tenantType: tenant.type,
    selfTenantIds: [tenantId],
    providerTenantIds,
    orgIds
  }
}

