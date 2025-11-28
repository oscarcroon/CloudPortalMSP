// @ts-nocheck

import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { and, eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { getDb } from './db'
import {
  organizationAuthSettings,
  organizationMemberships,
  organizations,
  tenantMemberships,
  tenants,
  users
} from '../database/schema'
import type { AuthOrganization, AuthState, AuthTenant } from '../types/auth'
import type { RbacRole, TenantRole } from '~/constants/rbac'
import { normalizeEmail } from './crypto'

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

const normalizeLogoUrl = (logoUrl: string | null | undefined): string | undefined => {
  if (!logoUrl) return undefined
  // Ta bort dubblerade /api/api/ prefix
  let normalized = logoUrl.replace(/\/api\/api\//g, '/api/')
  // Konvertera gamla format (/uploads/logos/...) till nya format (/api/uploads/logos/...)
  if (normalized.startsWith('/uploads/logos/')) {
    normalized = normalized.replace('/uploads/logos/', '/api/uploads/logos/')
  }
  // Om det redan är /api/uploads/logos/ eller fullständig URL, returnera som den är
  return normalized
}

const mapOrgRow = (row: MembershipRow, role: RbacRole, isSuperAdmin: boolean): AuthOrganization => ({
  id: row.org.id,
  name: row.org.name,
  slug: row.org.slug,
  status: row.org.status,
  isSuspended: Boolean(row.org.isSuspended),
  logoUrl: normalizeLogoUrl(row.org.logoUrl),
  requireSso: Boolean(row.org.requireSso),
  hasLocalLoginOverride:
    isSuperAdmin || (role === 'owner' && Boolean(row.auth?.allowLocalLoginForOwners)),
  role,
  tenantId: row.org.tenantId ?? null,
  lastAccessedAt: row.membership.lastAccessedAt ?? null
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

  const tenantRows = await fetchTenantMembershipRows(userId)
  const tenantRoles: Record<string, TenantRole> = {}
  const tenantIncludeChildren: Record<string, boolean> = {}
  const tenantPayload: AuthTenant[] = tenantRows.map((row) => {
    const role = row.membership.role as TenantRole
    tenantRoles[row.tenant.id] = role
    tenantIncludeChildren[row.tenant.id] = Boolean(row.membership.includeChildren)
    return mapTenantRow(row)
  })

  let resolvedOrgId: string | null
  if (forcedOrgId !== undefined) {
    resolvedOrgId = forcedOrgId && orgRoles[forcedOrgId] ? forcedOrgId : null
  } else if (user.defaultOrgId && orgRoles[user.defaultOrgId]) {
    // 1. Try primary organization (defaultOrgId)
    resolvedOrgId = user.defaultOrgId
  } else {
    // 2. Try most recently accessed organization
    const orgsWithAccess = organizationPayload
      .filter(org => org.lastAccessedAt !== null)
      .sort((a, b) => (b.lastAccessedAt ?? 0) - (a.lastAccessedAt ?? 0))
    
    if (orgsWithAccess.length > 0) {
      resolvedOrgId = orgsWithAccess[0].id
    } else {
      // 3. Fallback: first organization (alphabetically if multiple)
      const sortedOrgs = [...organizationPayload].sort((a, b) => a.name.localeCompare(b.name))
      resolvedOrgId = sortedOrgs[0]?.id ?? null
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
    resolvedTenantId = forcedTenantId && tenantRoles[forcedTenantId] ? forcedTenantId : null
  } else {
    resolvedTenantId = tenantPayload[0]?.id ?? null
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      defaultOrgId: user.defaultOrgId,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      forcePasswordReset: Boolean(user.forcePasswordReset)
    },
    organizations: organizationPayload,
    tenants: tenantPayload,
    orgRoles,
    tenantRoles,
    tenantIncludeChildren,
    currentOrgId: resolvedOrgId,
    currentTenantId: resolvedTenantId,
    sessionIssuedAt: new Date().toISOString()
  }
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
  organizationId: string
  role?: RbacRole
}

export const createUserWithOrganization = async (
  input: CreateUserWithOrgInput
): Promise<{ userId: string; organizationId: string }> => {
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'
  if (isSqlite) {
    return db.transaction((tx) => {
      const orgId = createId()
      const userId = createId()
      const organization: typeof organizations.$inferInsert = {
        id: orgId,
        name: input.organizationName,
        slug: slugify(input.organizationName),
        status: 'active'
      }
      tx.insert(organizations).values(organization).run()

      const user: typeof users.$inferInsert = {
        id: userId,
        email: normalizeEmail(input.email),
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        status: 'active',
        defaultOrgId: orgId
      }
      tx.insert(users).values(user).run()

      tx.insert(organizationMemberships)
        .values({
          id: createId(),
          organizationId: orgId,
          userId,
          role: 'owner',
          status: 'active'
        })
        .run()

      return { userId, organizationId: orgId }
    })
  }

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
  const rows = await fetchMembershipRows(userId)
  return rows.map((row) => mapOrgRow(row, row.membership.role as RbacRole))
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

