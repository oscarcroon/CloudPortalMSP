import { getHeader, getQuery, H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { useRuntimeConfig } from '#imports'
import { getDb } from './db'
import type { DrizzleDb } from './db'
import { organizations, tenants } from '../database/schema'

type TenantType = 'provider' | 'distributor' | 'organization'

export type LoginBrandingSource = 'custom-domain' | 'slug-host' | 'query' | 'default'

export interface LoginBrandingContext {
  host: string | null
  source: LoginBrandingSource
  tenantId: string | null
  tenantSlug: string | null
  tenantType: TenantType | null
  organizationId: string | null
  organizationSlug: string | null
}

interface TenantRecord {
  id: string
  slug: string
  type: TenantType
  customDomainVerificationStatus: string
}

interface OrganizationRecord {
  id: string
  slug: string
  tenantId: string | null
}

export async function resolveLoginBrandingContext(event: H3Event): Promise<LoginBrandingContext> {
  if (event.context.loginBranding) {
    return event.context.loginBranding
  }

  const db = getDb()
  const runtime = useRuntimeConfig()
  const slugSuffixes = resolveSlugSuffixes(runtime)
  const allowUnverifiedCustomDomains =
    runtime.loginBranding?.allowUnverifiedCustomDomains === true
  const host = normalizeHost(getForwardedHost(event))

  let tenant: TenantRecord | null = null
  let source: LoginBrandingSource = 'default'

  if (host) {
    tenant = await findTenantByCustomDomain(db, host)
    const isVerified =
      tenant?.customDomainVerificationStatus === 'verified' || allowUnverifiedCustomDomains
    if (tenant && isVerified) {
      source = 'custom-domain'
    } else {
      tenant = null
    }
  }

  if (!tenant && host) {
    const slugCandidate = extractSlugFromHost(host, slugSuffixes)
    if (slugCandidate) {
      tenant = await findTenantBySlug(db, slugCandidate)
      if (tenant) {
        source = 'slug-host'
      }
    }
  }

  const query = getQuery(event)
  const tenantSlugFromQuery =
    typeof query.tenant === 'string' ? sanitizeSlug(query.tenant) : null
  if (!tenant && tenantSlugFromQuery) {
    tenant = await findTenantBySlug(db, tenantSlugFromQuery)
    if (tenant) {
      source = 'query'
    }
  }

  const orgSlug = typeof query.org === 'string' ? sanitizeSlug(query.org) : null
  let organization: OrganizationRecord | null = null

  if (orgSlug) {
    organization = await findOrganizationBySlug(db, orgSlug)
    if (organization) {
      if (tenant && organization.tenantId && tenant.id !== organization.tenantId) {
        organization = null
      } else if (!tenant && organization.tenantId) {
        tenant = await findTenantById(db, organization.tenantId)
      }
      if (organization && source === 'default') {
        source = 'query'
      }
    }
  }

  const context: LoginBrandingContext = {
    host,
    source,
    tenantId: tenant?.id ?? null,
    tenantSlug: tenant?.slug ?? null,
    tenantType: tenant?.type ?? null,
    organizationId: organization?.id ?? null,
    organizationSlug: organization?.slug ?? null
  }

  event.context.loginBranding = context
  return context
}

function getForwardedHost(event: H3Event) {
  const forwardedHost = getHeader(event, 'x-forwarded-host')
  if (forwardedHost) {
    return forwardedHost.split(',')[0]?.trim() ?? null
  }
  return event.node.req.headers.host ?? null
}

function normalizeHost(hostValue?: string | null) {
  if (!hostValue) {
    return null
  }
  const trimmed = hostValue.trim().toLowerCase()
  if (!trimmed) {
    return null
  }
  const [withoutPort] = trimmed.split(':')
  return withoutPort || null
}

function resolveSlugSuffixes(runtime: ReturnType<typeof useRuntimeConfig>) {
  const raw = runtime.loginBranding?.slugSuffixes
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(normalizeSuffix)
  }
  const envValue = process.env.LOGIN_BRANDING_SLUG_SUFFIXES
  if (envValue) {
    return envValue
      .split(',')
      .map(normalizeSuffix)
      .filter(Boolean)
  }
  return ['.portal.coreit.cloud']
}

function normalizeSuffix(value: string) {
  return value.trim().toLowerCase()
}

function extractSlugFromHost(host: string, suffixes: string[]) {
  for (const suffix of suffixes) {
    if (suffix && host.endsWith(suffix) && host.length > suffix.length) {
      const raw = host.slice(0, -suffix.length)
      return raw.replace(/\.$/, '')
    }
  }
  return null
}

export const loginBrandingTestUtils = {
  normalizeHost,
  extractSlugFromHost
}

function sanitizeSlug(value: string) {
  return value.trim().toLowerCase()
}

async function findTenantBySlug(db: DrizzleDb, slug: string) {
  if (!slug) {
    return null
  }
  const rows = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      type: tenants.type,
      customDomainVerificationStatus: tenants.customDomainVerificationStatus
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)

  return rows[0] ?? null
}

async function findTenantByCustomDomain(db: DrizzleDb, domain: string) {
  if (!domain) {
    return null
  }
  const rows = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      type: tenants.type,
      customDomainVerificationStatus: tenants.customDomainVerificationStatus
    })
    .from(tenants)
    .where(eq(tenants.customDomain, domain))
    .limit(1)

  return rows[0] ?? null
}

async function findTenantById(db: DrizzleDb, tenantId: string) {
  const rows = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      type: tenants.type,
      customDomainVerificationStatus: tenants.customDomainVerificationStatus
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  return rows[0] ?? null
}

async function findOrganizationBySlug(db: DrizzleDb, slug: string) {
  if (!slug) {
    return null
  }
  const rows = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      tenantId: organizations.tenantId
    })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1)

  return rows[0] ?? null
}

