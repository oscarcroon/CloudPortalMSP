import { createId } from '@paralleldrive/cuid2'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { createError, getRouterParam } from 'h3'
import type { DrizzleDb } from '~~/server/utils/db'
import {
  organizationAuthSettings,
  organizationInvitations,
  organizationMemberships,
  organizations,
  tenants
} from '~~/server/database/schema'
import type {
  OrganizationAuthSettings as OrganizationAuthSettingsDto,
  OrganizationIdpType,
  OrganizationMemberStatus
} from '~/types/admin'

export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const parseOrgParam = (event: H3Event, paramName = 'orgId') => {
  const value = getRouterParam(event, paramName)
  if (!value) {
    throw createError({ statusCode: 400, message: 'Saknar organisations-id' })
  }
  return value
}

export const findOrganizationByIdentifier = async (db: DrizzleDb, identifier: string) => {
  const [bySlug] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, identifier))
    .limit(1)
  if (bySlug) {
    return bySlug
  }

  const [byId] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, identifier))
    .limit(1)
  return byId ?? null
}

export const requireOrganizationByIdentifier = async (
  db: DrizzleDb,
  identifier: string
) => {
  const organization = await findOrganizationByIdentifier(db, identifier)
  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organisationen kunde inte hittas.' })
  }
  return organization
}

export const ensureOrganizationAuthSettings = async (
  db: DrizzleDb,
  organizationId: string
) => {
  const [existing] = await db
    .select()
    .from(organizationAuthSettings)
    .where(eq(organizationAuthSettings.organizationId, organizationId))
    .limit(1)
  if (existing) {
    return existing
  }
  await db.insert(organizationAuthSettings).values({
    organizationId,
    idpType: 'none',
    ssoEnforced: false,
    allowLocalLoginForOwners: true
  })
  const [inserted] = await db
    .select()
    .from(organizationAuthSettings)
    .where(eq(organizationAuthSettings.organizationId, organizationId))
    .limit(1)
  if (!inserted) {
    throw createError({
      statusCode: 500,
      message: 'Kunde inte initiera auth-inställningar för organisationen.'
    })
  }
  return inserted
}

export const serializeAuthSettings = (
  record: typeof organizationAuthSettings.$inferSelect
): OrganizationAuthSettingsDto => ({
  organizationId: record.organizationId,
  idpType: record.idpType as OrganizationIdpType,
  ssoEnforced: Boolean(record.ssoEnforced),
  allowLocalLoginForOwners: Boolean(record.allowLocalLoginForOwners),
  idpConfig: record.idpConfig ? safeParseJson(record.idpConfig) : null
})

const safeParseJson = (value: string) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const stringifyIdpConfig = (value: unknown) => {
  if (value === undefined || value === null) {
    return null
  }
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

export const countActiveOwners = async (
  db: DrizzleDb,
  organizationId: string,
  excludeMembershipId?: string
) => {
  const conditions = [
    eq(organizationMemberships.organizationId, organizationId),
    eq(organizationMemberships.role, 'owner'),
    eq(organizationMemberships.status, 'active' as OrganizationMemberStatus)
  ]
  if (excludeMembershipId) {
    conditions.push(ne(organizationMemberships.id, excludeMembershipId))
  }

  const [result] = await db
    .select({
      value: sql<number>`count(${organizationMemberships.id})`
    })
    .from(organizationMemberships)
    .where(and(...conditions))
  return result?.value ?? 0
}

export const assertOwnerWillRemain = async (
  db: DrizzleDb,
  organizationId: string,
  excludeMembershipId?: string
) => {
  const remaining = await countActiveOwners(db, organizationId, excludeMembershipId)
  if (remaining < 1) {
    throw createError({
      statusCode: 400,
      message: 'Organisationen måste ha minst en ägare.'
    })
  }
}

export const createInviteToken = () => createId()

export const buildOrganizationDetailPayload = async (db: DrizzleDb, organizationId: string) => {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organisationen kunde inte hittas.' })
  }

  const authSettings = await ensureOrganizationAuthSettings(db, organizationId)

  const [memberStats] = await db
    .select({
      memberCount: sql<number>`count(${organizationMemberships.id})`,
      activeMembers: sql<number>`sum(case when ${organizationMemberships.status} = 'active' then 1 else 0 end)`
    })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.organizationId, organizationId))

  const [inviteStats] = await db
    .select({
      pendingInvites: sql<number>`sum(case when ${organizationInvitations.status} = 'pending' then 1 else 0 end)`
    })
    .from(organizationInvitations)
    .where(eq(organizationInvitations.organizationId, organizationId))

  // Hämta provider-info om tenantId finns
  let provider = null
  if (organization.tenantId) {
    const [providerTenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug
      })
      .from(tenants)
      .where(eq(tenants.id, organization.tenantId))
      .limit(1)
    
    if (providerTenant) {
      provider = {
        id: providerTenant.id,
        name: providerTenant.name,
        slug: providerTenant.slug
      }
    }
  }

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      tenantId: organization.tenantId,
      billingEmail: organization.billingEmail,
      coreId: organization.coreId,
      defaultRole: organization.defaultRole,
      requireSso: Boolean(organization.requireSso),
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt
    },
    provider,
    authSettings: serializeAuthSettings(authSettings),
    stats: {
      memberCount: memberStats?.memberCount ?? 0,
      activeMembers: memberStats?.activeMembers ?? 0,
      pendingInvites: inviteStats?.pendingInvites ?? 0
    }
  }
}

