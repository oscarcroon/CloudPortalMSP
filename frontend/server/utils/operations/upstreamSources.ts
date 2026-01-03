/**
 * Upstream Sources Resolver for Operations (Incidents/News)
 *
 * Resolves the set of tenant IDs from which a context (org or tenant) should inherit
 * operational content like incidents and news posts.
 *
 * Handles the many-to-many distributor↔provider relationship via distributor_providers.
 */

import { eq, inArray } from 'drizzle-orm'
import { getDb } from '../db'
import { organizations, tenants, distributorProviders } from '../../database/schema'

export interface UpstreamSourcesResult {
  /** All tenant IDs that can publish content visible in this context */
  sourceIds: string[]
  /** The current context type */
  contextType: 'organization' | 'tenant'
  /** Current org ID (if org context) */
  orgId?: string
  /** Current tenant ID (if tenant context) */
  tenantId?: string
}

/**
 * Get upstream source tenant IDs for an organization context.
 * Sources = org's provider tenant + all distributors linked to that provider.
 */
export async function getUpstreamSourcesForOrg(orgId: string): Promise<UpstreamSourcesResult> {
  const db = getDb()

  // Get the organization's tenant (provider)
  const [org] = await db
    .select({ tenantId: organizations.tenantId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org?.tenantId) {
    return { sourceIds: [], contextType: 'organization', orgId }
  }

  const providerTenantId = org.tenantId
  const sources = new Set<string>([providerTenantId])

  // Get distributors linked to this provider via distributor_providers
  const distributorLinks = await db
    .select({ distributorId: distributorProviders.distributorId })
    .from(distributorProviders)
    .where(eq(distributorProviders.providerId, providerTenantId))

  for (const link of distributorLinks) {
    sources.add(link.distributorId)
  }

  return {
    sourceIds: Array.from(sources),
    contextType: 'organization',
    orgId,
    tenantId: providerTenantId
  }
}

/**
 * Get upstream source tenant IDs for a tenant context.
 * - If distributor: only self
 * - If provider: self + linked distributors
 */
export async function getUpstreamSourcesForTenant(tenantId: string): Promise<UpstreamSourcesResult> {
  const db = getDb()

  // Get tenant type
  const [tenant] = await db
    .select({ type: tenants.type })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    return { sourceIds: [], contextType: 'tenant', tenantId }
  }

  const sources = new Set<string>([tenantId])

  // If provider, add linked distributors
  if (tenant.type === 'provider') {
    const distributorLinks = await db
      .select({ distributorId: distributorProviders.distributorId })
      .from(distributorProviders)
      .where(eq(distributorProviders.providerId, tenantId))

    for (const link of distributorLinks) {
      sources.add(link.distributorId)
    }
  }

  return {
    sourceIds: Array.from(sources),
    contextType: 'tenant',
    tenantId
  }
}

/**
 * Resolves upstream sources based on current auth context.
 * Prioritizes org context if both are available.
 */
export async function getUpstreamSources(opts: {
  currentOrgId?: string | null
  currentTenantId?: string | null
}): Promise<UpstreamSourcesResult> {
  // Prioritize org context for feed resolution
  if (opts.currentOrgId) {
    return getUpstreamSourcesForOrg(opts.currentOrgId)
  }

  if (opts.currentTenantId) {
    return getUpstreamSourcesForTenant(opts.currentTenantId)
  }

  return { sourceIds: [], contextType: 'organization' }
}

/**
 * Get tenant metadata for source pills (tenant name + type)
 */
export async function getSourceTenantInfo(tenantIds: string[]): Promise<
  Map<string, { name: string; type: 'provider' | 'distributor' | 'organization' }>
> {
  if (tenantIds.length === 0) return new Map()

  const db = getDb()
  const tenantData = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      type: tenants.type
    })
    .from(tenants)
    .where(inArray(tenants.id, tenantIds))

  const map = new Map<string, { name: string; type: 'provider' | 'distributor' | 'organization' }>()
  for (const t of tenantData) {
    map.set(t.id, { name: t.name, type: t.type })
  }
  return map
}

