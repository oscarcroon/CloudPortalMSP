// @ts-nocheck

import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { and, asc, eq, inArray, isNull, or, gt } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { getDb } from './db'
import type { DrizzleDb } from './db'
import {
  brandingThemes,
  BrandingTargetType,
  organizationAuthSettings,
  organizationMemberships,
  organizations,
  distributorProviders,
  tenantMemberships,
  tenants,
  users,
  userModuleFavorites,
  mspOrgDelegations
} from '../database/schema'
import type { AuthOrganization, AuthState, AuthTenant } from '../types/auth'
import type { RbacRole, TenantRole } from '~/constants/rbac'
import { tenantRoleOrgProxyPermissions } from '~/constants/rbac'
import type { ModuleId } from '~/constants/modules'
import { moduleIds } from '~/constants/modules'
import { DEFAULT_LOCALE, type SupportedLocaleCode } from '~/constants/i18n'
import { normalizeEmail } from './crypto'
import { normalizeStoredLogoUrl, resolveBrandingChain } from './branding'

export const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `org-${randomUUID().slice(0, 8)}`

const fetchMembershipRows = async (userId: string) => {
  const db = getDb()
  return db
    .select({
      org: organizations,
      membership: organizationMemberships,
      auth: organizationAuthSettings
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .leftJoin(
      organizationAuthSettings,
      eq(organizationAuthSettings.organizationId, organizations.id)
    )
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, 'active')
      )
    )
}

type MembershipRow = {
  org: typeof organizations.$inferSelect
  membership: typeof organizationMemberships.$inferSelect
  auth: typeof organizationAuthSettings.$inferSelect | null
}

const mapOrgRow = (row: MembershipRow, role: RbacRole, isSuperAdmin: boolean): AuthOrganization => ({
  id: row.org.id,
  name: row.org.name,
  slug: row.org.slug,
  status: row.org.status,
  isSuspended: Boolean(row.org.isSuspended),
  logoUrl: normalizeStoredLogoUrl(row.org.logoUrl),
  requireSso: Boolean(row.org.requireSso),
  hasLocalLoginOverride:
    isSuperAdmin || (role === 'owner' && Boolean(row.auth?.allowLocalLoginForOwners)),
  role,
  tenantId: row.org.tenantId ?? null,
  lastAccessedAt: row.membership.lastAccessedAt ?? null,
  accessType: 'direct',
  setupStatus: (row.org.setupStatus as 'pending' | 'complete') ?? 'complete'
})

export const findUserByEmail = async (email: string) => {
  const db = getDb()
  const normalized = normalizeEmail(email)
  const [user] = await db.select().from(users).where(eq(users.email, normalized))
  return user ?? null
}

const fetchTenantMembershipRows = async (userId: string) => {
  const db = getDb()
  return db
    .select({
      tenant: tenants,
      membership: tenantMemberships
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.status, 'active')
      )
    )
}

type TenantMembershipRow = {
  tenant: typeof tenants.$inferSelect
  membership: typeof tenantMemberships.$inferSelect
}

const mapTenantRow = (row: TenantMembershipRow): AuthTenant => ({
  id: row.tenant.id,
  name: row.tenant.name,
  slug: row.tenant.slug,
  type: row.tenant.type as 'provider' | 'distributor' | 'organization',
  parentTenantId: row.tenant.parentTenantId ?? null,
  role: row.membership.role as TenantRole,
  includeChildren: Boolean(row.membership.includeChildren),
  status: row.tenant.status
})

export const buildAuthState = async (
  userId: string,
  forcedOrgId?: string | null,
  forcedTenantId?: string | null,
  presetRoles?: Record<string, RbacRole>
): Promise<AuthState> => {
  const db = getDb()
  const allowedModuleIds = new Set<ModuleId>(moduleIds as ModuleId[])

  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  if (user.status !== 'active') {
    throw createError({ statusCode: 403, message: 'Kontot är inaktiverat.' })
  }

  const rows = await fetchMembershipRows(userId)
  const orgRoles: Record<string, RbacRole> = presetRoles ? { ...presetRoles } : {}

  const organizationPayload: AuthOrganization[] = rows.map((row) => {
    const role = row.membership.role as RbacRole
    orgRoles[row.org.id] = role
    return mapOrgRow(row, role, Boolean(user.isSuperAdmin))
  })

  const resolvedLogos = await resolveOrganizationLogos(db, rows)
  for (const org of organizationPayload) {
    if (resolvedLogos.has(org.id)) {
      org.logoUrl = resolvedLogos.get(org.id) ?? null
    }
  }

  // Delegation-baserade orgar (MSP → Org)
  const delegationRows = await db
    .select({
      org: organizations,
      delegation: mspOrgDelegations
    })
    .from(mspOrgDelegations)
    .innerJoin(organizations, eq(organizations.id, mspOrgDelegations.orgId))
    .where(and(eq(mspOrgDelegations.subjectId, userId), eq(mspOrgDelegations.subjectType, 'user')))

  const now = Date.now()
  for (const row of delegationRows) {
    const expiresAt = row.delegation.expiresAt
    const isExpired = expiresAt !== null && expiresAt !== undefined && expiresAt <= now
    const isRevoked = row.delegation.revokedAt !== null && row.delegation.revokedAt !== undefined
    if (isExpired || isRevoked) continue
    const already = organizationPayload.some((org) => org.id === row.org.id)
    if (already) continue
    organizationPayload.push({
      id: row.org.id,
      name: row.org.name,
      slug: row.org.slug,
      status: row.org.status,
      isSuspended: Boolean(row.org.isSuspended),
      logoUrl: normalizeStoredLogoUrl(row.org.logoUrl),
      requireSso: Boolean(row.org.requireSso),
      hasLocalLoginOverride: false,
      role: 'viewer',
      tenantId: row.org.tenantId ?? null,
      lastAccessedAt: null,
      accessType: 'delegation',
      expiresAt: expiresAt ?? null,
      setupStatus: (row.org.setupStatus as 'pending' | 'complete') ?? 'complete'
    } as any)
  }

  const tenantRows = await fetchTenantMembershipRows(userId)
  const tenantRoles: Record<string, TenantRole> = {}
  const tenantIncludeChildren: Record<string, boolean> = {}
  const tenantPayload: AuthTenant[] = tenantRows.map((row) => {
    const role = row.membership.role as TenantRole
    tenantRoles[row.tenant.id] = role
    tenantIncludeChildren[row.tenant.id] = Boolean(row.membership.includeChildren)
    return mapTenantRow(row)
  })

  const favoriteRows = await db
    .select({
      moduleId: userModuleFavorites.moduleId,
      displayOrder: userModuleFavorites.displayOrder
    })
    .from(userModuleFavorites)
    .where(eq(userModuleFavorites.userId, userId))
    .orderBy(asc(userModuleFavorites.displayOrder), asc(userModuleFavorites.createdAt))

  const favoriteModules: ModuleId[] = []
  for (const row of favoriteRows) {
    const moduleId = row.moduleId as ModuleId
    if (allowedModuleIds.has(moduleId) && !favoriteModules.includes(moduleId)) {
      favoriteModules.push(moduleId)
    }
  }

  const selectOrgFromPayload = () => {
    if (organizationPayload.length === 0) {
      return null
    }
    const orgsWithAccess = organizationPayload
      .filter((org) => org.lastAccessedAt !== null)
      .sort((a, b) => (b.lastAccessedAt ?? 0) - (a.lastAccessedAt ?? 0))
    if (orgsWithAccess.length > 0) {
      return orgsWithAccess[0].id
    }
    const sortedOrgs = [...organizationPayload].sort((a, b) => a.name.localeCompare(b.name))
    return sortedOrgs[0]?.id ?? null
  }

  let resolvedOrgId: string | null
  if (forcedOrgId !== undefined) {
    resolvedOrgId = forcedOrgId
  } else if (user.defaultOrgId && organizationPayload.some((org) => org.id === user.defaultOrgId)) {
    // 1. Try primary organization (defaultOrgId) if still accessible
    resolvedOrgId = user.defaultOrgId
  } else {
    resolvedOrgId = selectOrgFromPayload()
  }

  const allowedProxyTenantTypes = new Set(['provider', 'distributor'])
  const deriveProxyRoleForTenant = (tenantId?: string | null): RbacRole | null => {
    if (!tenantId) return null
    const tenantRole = tenantRoles[tenantId]
    const includeChildren = tenantIncludeChildren[tenantId]
    const tenantInfo = tenantPayload.find((tenant) => tenant.id === tenantId)
    if (!tenantRole || !includeChildren || !tenantInfo || !allowedProxyTenantTypes.has(tenantInfo.type)) {
      return null
    }
    const proxyPermissions = tenantRoleOrgProxyPermissions[tenantRole] ?? []
    if (proxyPermissions.includes('org:manage')) {
      return 'admin'
    }
    if (proxyPermissions.includes('org:read')) {
      return 'viewer'
    }
    return null
  }

  // Add proxy organizations for resolvedOrgId if user has access via tenant + includeChildren
  // Also add for superadmins who can access any organization
  // Check organizationPayload instead of orgRoles since presetRoles may contain stale roles
  // for organizations no longer in the payload (e.g., superadmin switching to org via forcedOrgId)
  const orgAlreadyInPayload = organizationPayload.some((org) => org.id === resolvedOrgId)
  if (resolvedOrgId && !orgAlreadyInPayload) {
    const [resolvedOrg] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        tenantId: organizations.tenantId,
        status: organizations.status,
        isSuspended: organizations.isSuspended,
        logoUrl: organizations.logoUrl,
        requireSso: organizations.requireSso,
        setupStatus: organizations.setupStatus
      })
      .from(organizations)
      .where(eq(organizations.id, resolvedOrgId))

    if (resolvedOrg) {
      const proxyRole = deriveProxyRoleForTenant(resolvedOrg.tenantId)
      // Superadmins can access any organization - give them admin role
      const effectiveRole = proxyRole ?? (user.isSuperAdmin ? 'admin' : null)
      if (effectiveRole) {
        const proxyOrg: AuthOrganization = {
          id: resolvedOrg.id,
          name: resolvedOrg.name,
          slug: resolvedOrg.slug,
          status: resolvedOrg.status,
          isSuspended: Boolean(resolvedOrg.isSuspended),
          logoUrl: normalizeStoredLogoUrl(resolvedOrg.logoUrl),
          requireSso: Boolean(resolvedOrg.requireSso),
          hasLocalLoginOverride: user.isSuperAdmin, // Superadmins can bypass SSO
          role: effectiveRole,
          tenantId: resolvedOrg.tenantId ?? null,
          lastAccessedAt: null,
          accessType: user.isSuperAdmin && !proxyRole ? 'superadmin' : 'msp',
          setupStatus: (resolvedOrg.setupStatus as 'pending' | 'complete') ?? 'complete'
        }
        organizationPayload.push(proxyOrg)
        orgRoles[proxyOrg.id] = effectiveRole
      }
    }
  }

  // Also add proxy organizations for all orgs that user has access to via tenant + includeChildren
  // This ensures that orgs are available in the organizations list even if not yet selected
  const tenantIdsWithIncludeChildren = Object.keys(tenantRoles).filter(
    (tenantId) => tenantIncludeChildren[tenantId] && tenantPayload.find((t) => t.id === tenantId && allowedProxyTenantTypes.has(t.type))
  )

  if (tenantIdsWithIncludeChildren.length > 0) {
    const proxyOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        tenantId: organizations.tenantId,
        status: organizations.status,
        isSuspended: organizations.isSuspended,
        logoUrl: organizations.logoUrl,
        requireSso: organizations.requireSso,
        setupStatus: organizations.setupStatus
      })
      .from(organizations)
      .where(
        and(
          inArray(organizations.tenantId, tenantIdsWithIncludeChildren),
          eq(organizations.status, 'active')
        )
      )

    for (const org of proxyOrgs) {
      // Skip if already in organizationPayload
      if (organizationPayload.find((o) => o.id === org.id)) {
        continue
      }

      const proxyRole = deriveProxyRoleForTenant(org.tenantId)
      if (!proxyRole) {
        continue
      }

      const proxyOrg: AuthOrganization = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        isSuspended: Boolean(org.isSuspended),
        logoUrl: normalizeStoredLogoUrl(org.logoUrl),
        requireSso: Boolean(org.requireSso),
        hasLocalLoginOverride: false,
        role: proxyRole,
        tenantId: org.tenantId ?? null,
        lastAccessedAt: null,
        accessType: 'msp',
        setupStatus: (org.setupStatus as 'pending' | 'complete') ?? 'complete'
      }
      organizationPayload.push(proxyOrg)
      // Always update orgRoles with proxy role, even if it was in presetRoles
      // This ensures proxy orgs are always included in the auth state
      orgRoles[proxyOrg.id] = proxyRole
    }
  }
  
  const hasOrgInPayload = (orgId?: string | null) =>
    Boolean(orgId && organizationPayload.some((org) => org.id === orgId))

  if (
    forcedOrgId === undefined &&
    user.defaultOrgId &&
    hasOrgInPayload(user.defaultOrgId)
  ) {
    resolvedOrgId = user.defaultOrgId
  }

  const resolvedOrgExists = hasOrgInPayload(resolvedOrgId)
  if (forcedOrgId !== undefined) {
    if (forcedOrgId === null) {
      resolvedOrgId = null
    } else if (hasOrgInPayload(forcedOrgId)) {
      resolvedOrgId = forcedOrgId
    } else if (!resolvedOrgExists && organizationPayload.length > 0) {
      resolvedOrgId = selectOrgFromPayload()
    }
  } else if (!resolvedOrgExists && organizationPayload.length > 0) {
    if (user.defaultOrgId && hasOrgInPayload(user.defaultOrgId)) {
      resolvedOrgId = user.defaultOrgId
    } else {
      resolvedOrgId = selectOrgFromPayload()
    }
  }
  
  // Sanitize invalid defaultOrgId: if user's defaultOrgId points to an org they're no longer a member of
  if (user.defaultOrgId && !orgRoles[user.defaultOrgId]) {
    // Reset defaultOrgId - this will be persisted on next user update
    user.defaultOrgId = null
  }

  // Resolve currentTenantId: use forcedTenantId if provided (even if null)
  // otherwise use first tenant in list
  let resolvedTenantId: string | null
  if (forcedTenantId !== undefined) {
    if (forcedTenantId && tenantRoles[forcedTenantId]) {
      // User has membership in this tenant
      resolvedTenantId = forcedTenantId
    } else if (forcedTenantId && user.isSuperAdmin) {
      // Superadmin can switch to any tenant without membership
      // Fetch the tenant and add it to tenantPayload if not already present
      const existingTenant = tenantPayload.find((t) => t.id === forcedTenantId)
      if (!existingTenant) {
        const [targetTenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, forcedTenantId))
        
        if (targetTenant) {
          const superadminTenant: AuthTenant = {
            id: targetTenant.id,
            name: targetTenant.name,
            slug: targetTenant.slug,
            type: targetTenant.type as 'provider' | 'distributor' | 'organization',
            parentTenantId: targetTenant.parentTenantId ?? null,
            role: 'admin' as TenantRole, // Superadmins get admin role
            includeChildren: true,
            status: targetTenant.status
          }
          tenantPayload.push(superadminTenant)
          tenantRoles[targetTenant.id] = 'admin' as TenantRole
          tenantIncludeChildren[targetTenant.id] = true
        }
      }
      resolvedTenantId = forcedTenantId
    } else {
      resolvedTenantId = null
    }
  } else {
    resolvedTenantId = tenantPayload[0]?.id ?? null
  }

  let brandingState = null
  if (resolvedOrgId) {
    brandingState = await resolveBrandingChain({ organizationId: resolvedOrgId })
  } else if (resolvedTenantId) {
    const currentTenant = tenantPayload.find((tenant) => tenant.id === resolvedTenantId)
    if (currentTenant && (currentTenant.type === 'provider' || currentTenant.type === 'distributor')) {
      brandingState = await resolveBrandingChain({ tenantId: resolvedTenantId })
    }
  }

  const result = {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl ?? null,
      status: user.status,
      defaultOrgId: user.defaultOrgId,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      forcePasswordReset: Boolean(user.forcePasswordReset),
      locale: (user.locale as SupportedLocaleCode) ?? DEFAULT_LOCALE
    },
    organizations: organizationPayload,
    tenants: tenantPayload,
    orgRoles,
    tenantRoles,
    tenantIncludeChildren,
    currentOrgId: resolvedOrgId,
    currentTenantId: resolvedTenantId,
    favoriteModules,
    sessionIssuedAt: new Date().toISOString(),
    branding: brandingState
  }
  
  return result
}

async function resolveOrganizationLogos(db: DrizzleDb, rows: MembershipRow[]) {
  const orgIds = rows.map((row) => row.org.id)
  if (orgIds.length === 0) {
    return new Map<string, string | null>()
  }

  const providerIds = Array.from(
    new Set(rows.map((row) => row.org.tenantId).filter((id): id is string => Boolean(id)))
  )
  const providerToDistributor = await loadProviderDistributors(db, providerIds)
  const distributorIds = Array.from(new Set(providerToDistributor.values()))

  const orgBrandRows =
    orgIds.length > 0
      ? await db
          .select()
          .from(brandingThemes)
          .where(inArray(brandingThemes.organizationId, orgIds))
      : []

  const providerBrandRows =
    providerIds.length > 0
      ? await db
          .select()
          .from(brandingThemes)
          .where(
            and(
              eq(brandingThemes.targetType, 'provider'),
              inArray(brandingThemes.tenantId, providerIds)
            )
          )
      : []

  const distributorBrandRows =
    distributorIds.length > 0
      ? await db
          .select()
          .from(brandingThemes)
          .where(
            and(
              eq(brandingThemes.targetType, 'distributor'),
              inArray(brandingThemes.tenantId, distributorIds)
            )
          )
      : []

  const orgBrandMap = new Map<string, string | null>()
  const providerBrandMap = new Map<string, string | null>()
  const distributorBrandMap = new Map<string, string | null>()

  for (const row of orgBrandRows) {
    if (row.organizationId) {
      orgBrandMap.set(
        row.organizationId,
        row.appLogoLightUrl ?? row.logoUrl ?? null
      )
    }
  }
  for (const row of providerBrandRows) {
    if (row.tenantId) {
      providerBrandMap.set(
        row.tenantId,
        row.appLogoLightUrl ?? row.logoUrl ?? null
      )
    }
  }
  for (const row of distributorBrandRows) {
    if (row.tenantId) {
      distributorBrandMap.set(
        row.tenantId,
        row.appLogoLightUrl ?? row.logoUrl ?? null
      )
    }
  }

  const resolved = new Map<string, string | null>()

  for (const membershipRow of rows) {
    const organizationId = membershipRow.org.id
    const providerId = membershipRow.org.tenantId ?? null
    const distributorId = providerId ? providerToDistributor.get(providerId) ?? null : null

    const directLogo = orgBrandMap.has(organizationId)
      ? orgBrandMap.get(organizationId)
      : membershipRow.org.logoUrl
    const providerLogo = providerId ? providerBrandMap.get(providerId) ?? null : null
    const distributorLogo = distributorId ? distributorBrandMap.get(distributorId) ?? null : null

    const resolvedLogo = normalizeStoredLogoUrl(directLogo ?? providerLogo ?? distributorLogo ?? null)
    resolved.set(organizationId, resolvedLogo ?? null)
  }

  return resolved
}

async function loadProviderDistributors(db: DrizzleDb, providerIds: string[]) {
  const map = new Map<string, string>()
  if (providerIds.length === 0) {
    return map
  }

  const rows = await db
    .select({
      providerId: distributorProviders.providerId,
      distributorId: distributorProviders.distributorId
    })
    .from(distributorProviders)
    .where(inArray(distributorProviders.providerId, providerIds))
    .orderBy(asc(distributorProviders.createdAt))

  for (const row of rows) {
    if (!map.has(row.providerId)) {
      map.set(row.providerId, row.distributorId)
    }
  }

  return map
}

export interface CreateUserWithOrgInput {
  email: string
  passwordHash: string
  fullName?: string
  organizationName: string
}

export interface CreateUserForOrganizationInput {
  email: string
  fullName?: string
  profilePictureUrl?: string
  organizationId: string
  role?: RbacRole
}

export const createUserWithOrganization = async (
  input: CreateUserWithOrgInput
): Promise<{ userId: string; organizationId: string }> => {
  const db = getDb()
  return db.transaction(async (tx) => {
    const orgId = createId()
    const userId = createId()
    const organization: typeof organizations.$inferInsert = {
      id: orgId,
      name: input.organizationName,
      slug: slugify(input.organizationName),
      status: 'active'
    }
    await tx.insert(organizations).values(organization)

    const user: typeof users.$inferInsert = {
      id: userId,
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      status: 'active',
      defaultOrgId: orgId
    }
    await tx.insert(users).values(user)

    await tx.insert(organizationMemberships).values({
      id: createId(),
      organizationId: orgId,
      userId,
      role: 'owner',
      status: 'active'
    })

    return { userId, organizationId: orgId }
  })
}

export const createUserForOrganization = async (
  input: CreateUserForOrganizationInput
): Promise<{ userId: string }> => {
  const db = getDb()
  const userId = createId()
  const normalizedEmail = normalizeEmail(input.email)

  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    fullName: input.fullName,
    profilePictureUrl: input.profilePictureUrl,
    status: 'active',
    defaultOrgId: input.organizationId
  })

  await db.insert(organizationMemberships).values({
    id: createId(),
    organizationId: input.organizationId,
    userId,
    role: input.role ?? 'member',
    status: 'active'
  })

  return { userId }
}

export const ensureMembershipOrCreate = async (
  userId: string,
  organizationId: string,
  role: RbacRole
) => {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, 'active')
      )
    )
    .limit(1)
  if (existing) {
    return existing
  }

  await db.insert(organizationMemberships).values({
    id: createId(),
    organizationId,
    userId,
    role,
    status: 'active'
  })
}

export const ensureMembership = async (userId: string, organizationId: string) => {
  const db = getDb()
  const [membership] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.status, 'active')
      )
    )
  if (!membership) {
    throw createError({ statusCode: 403, message: 'Organisation not accessible' })
  }
  return membership
}

export const setUserDefaultOrg = async (userId: string, organizationId: string | null) => {
  const db = getDb()
  await db
    .update(users)
    .set({ defaultOrgId: organizationId ?? null })
    .where(eq(users.id, userId))
}

export const listOrganizationsForUser = async (userId: string) => {
  const db = getDb()
  
  // Get direct organization memberships
  const directRows = await fetchMembershipRows(userId)
  const directOrgs = directRows.map((row) => mapOrgRow(row, row.membership.role as RbacRole, false))
  
  // Get organizations accessible via MSP delegations
  const now = new Date()
  const delegatedOrgs = await db
    .select({
      org: organizations,
      auth: organizationAuthSettings
    })
    .from(mspOrgDelegations)
    .innerJoin(organizations, eq(organizations.id, mspOrgDelegations.orgId))
    .leftJoin(
      organizationAuthSettings,
      eq(organizationAuthSettings.organizationId, organizations.id)
    )
    .where(
      and(
        eq(mspOrgDelegations.subjectType, 'user'),
        eq(mspOrgDelegations.subjectId, userId),
        isNull(mspOrgDelegations.revokedAt),
        or(
          isNull(mspOrgDelegations.expiresAt),
          gt(mspOrgDelegations.expiresAt, now)
        ),
        eq(organizations.status, 'active')
      )
    )
  
  // Map delegated organizations (use default role 'viewer' for MSP access)
  const delegatedOrgList = delegatedOrgs.map((row) => ({
    id: row.org.id,
    name: row.org.name,
    slug: row.org.slug,
    status: row.org.status,
    isSuspended: Boolean(row.org.isSuspended),
    logoUrl: normalizeStoredLogoUrl(row.org.logoUrl),
    requireSso: Boolean(row.org.requireSso),
    hasLocalLoginOverride: false, // MSP users don't get local login override
    role: 'viewer' as RbacRole, // Default role for MSP access
    tenantId: row.org.tenantId ?? null,
    lastAccessedAt: null,
    accessType: 'delegated' as const
  }))
  
  // Combine and deduplicate by org ID (direct access takes precedence)
  const orgMap = new Map<string, AuthOrganization>()
  
  // Add direct organizations first
  for (const org of directOrgs) {
    orgMap.set(org.id, org)
  }
  
  // Add delegated organizations (skip if already in map)
  for (const org of delegatedOrgList) {
    if (!orgMap.has(org.id)) {
      orgMap.set(org.id, org)
    }
  }
  
  return Array.from(orgMap.values())
}

export const listOrganizationsForEmail = async (email: string) => {
  const user = await findUserByEmail(email)
  if (!user) {
    return { user: null, organizations: [] as AuthOrganization[] }
  }
  const organizations = await listOrganizationsForUser(user.id)
  return { user, organizations }
}

export const userRequiresSso = async (userId: string) => {
  const rows = await fetchMembershipRows(userId)
  return rows.some((row) => Boolean(row.org.requireSso))
}

export const touchUserLogin = async (userId: string) => {
  const db = getDb()
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))
}

