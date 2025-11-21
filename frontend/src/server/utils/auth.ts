// @ts-nocheck

import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { and, eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { getDb } from './db'
import { organizationMemberships, organizations, users } from '../database/schema'
import type { AuthOrganization, AuthState } from '../types/auth'
import type { RbacRole } from '~/constants/rbac'
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
      membership: organizationMemberships
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(eq(organizationMemberships.userId, userId))
}

type MembershipRow = {
  org: typeof organizations.$inferSelect
  membership: typeof organizationMemberships.$inferSelect
}

const mapOrgRow = (row: MembershipRow, role: RbacRole): AuthOrganization => ({
  id: row.org.id,
  name: row.org.name,
  slug: row.org.slug,
  status: row.org.status,
  isSuspended: Boolean(row.org.isSuspended),
  logoUrl: row.org.logoUrl ?? undefined,
  enforceSso: Boolean(row.org.enforceSso),
  role
})

export const findUserByEmail = async (email: string) => {
  const db = getDb()
  const normalized = normalizeEmail(email)
  const [user] = await db.select().from(users).where(eq(users.email, normalized))
  return user ?? null
}

export const buildAuthState = async (
  userId: string,
  forcedOrgId?: string | null,
  presetRoles?: Record<string, RbacRole>
): Promise<AuthState> => {
  const db = getDb()

  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const rows = await fetchMembershipRows(userId)
  const orgRoles: Record<string, RbacRole> = presetRoles ? { ...presetRoles } : {}

  const organizationPayload: AuthOrganization[] = rows.map((row) => {
    const role = row.membership.role as RbacRole
    orgRoles[row.org.id] = role
    return mapOrgRow(row, role)
  })

  const resolvedOrgId =
    forcedOrgId && orgRoles[forcedOrgId]
      ? forcedOrgId
      : user.defaultOrgId && orgRoles[user.defaultOrgId]
        ? user.defaultOrgId
        : organizationPayload[0]?.id ?? null

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      defaultOrgId: user.defaultOrgId,
      isSuperAdmin: Boolean(user.isSuperAdmin)
    },
    organizations: organizationPayload,
    orgRoles,
    currentOrgId: resolvedOrgId,
    sessionIssuedAt: new Date().toISOString()
  }
}

export interface CreateUserWithOrgInput {
  email: string
  passwordHash: string
  fullName?: string
  organizationName: string
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
      role: 'owner'
    })

    return { userId, organizationId: orgId }
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
        eq(organizationMemberships.organizationId, organizationId)
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
  return rows.some((row) => Boolean(row.org.enforceSso))
}

export const touchUserLogin = async (userId: string) => {
  const db = getDb()
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))
}

