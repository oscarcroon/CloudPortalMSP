import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { organizationInvitations, organizations, tenantInvitations, tenants, users } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { ensureAuthState } from '~~/server/utils/session'
import { normalizeEmail } from '~~/server/utils/crypto'
import { getOrganisationEmailProviderProfile } from '~~/server/utils/emailProvider'
import { normalizeLogoUrl } from '~/utils/logo'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, message: 'Saknar inbjudningstoken.' })
  }

  const db = getDb()
  const now = new Date()

  // Try tenant invitation first
  const [tenantInviteRow] = await db
    .select({
      id: tenantInvitations.id,
      tenantId: tenantInvitations.tenantId,
      email: tenantInvitations.email,
      role: tenantInvitations.role,
      status: tenantInvitations.status,
      token: tenantInvitations.token,
      expiresAt: tenantInvitations.expiresAt,
      createdAt: tenantInvitations.createdAt,
      invitedByUserId: tenantInvitations.invitedByUserId,
      organizationData: tenantInvitations.organizationData,
      tenantName: tenants.name,
      tenantType: tenants.type,
      invitedByEmail: users.email,
      invitedByName: users.fullName
    })
    .from(tenantInvitations)
    .leftJoin(tenants, eq(tenants.id, tenantInvitations.tenantId))
    .leftJoin(users, eq(users.id, tenantInvitations.invitedByUserId))
    .where(eq(tenantInvitations.token, token))

  if (tenantInviteRow) {
    // Handle tenant invitation
    let effectiveStatus = tenantInviteRow.status
    const expiresAtMs =
      tenantInviteRow.expiresAt instanceof Date
        ? tenantInviteRow.expiresAt.getTime()
        : typeof tenantInviteRow.expiresAt === 'number'
          ? tenantInviteRow.expiresAt
          : new Date(tenantInviteRow.expiresAt).getTime()

    if (effectiveStatus === 'pending' && !isNaN(expiresAtMs) && expiresAtMs < now.getTime()) {
      await db
        .update(tenantInvitations)
        .set({ status: 'expired', updatedAt: now })
        .where(eq(tenantInvitations.id, tenantInviteRow.id))
      effectiveStatus = 'expired'
    }

    const normalizedEmail = normalizeEmail(tenantInviteRow.email)
    const existingUser = await db
      .select({
        id: users.id,
        hasPassword: users.passwordHash
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)
      .get()

    const auth = await ensureAuthState(event)
    const isSessionMatching =
      Boolean(auth?.user?.email) &&
      normalizeEmail(auth.user.email) === normalizedEmail &&
      effectiveStatus === 'pending'

    // Parse organization data if present
    let organizationData: any = null
    let willCreateOrganization = false
    if (tenantInviteRow.organizationData) {
      try {
        organizationData = JSON.parse(tenantInviteRow.organizationData)
        willCreateOrganization = true
      } catch {
        // Invalid JSON, ignore
      }
    }

    // Get branding from global email provider (tenants don't have their own branding)
    const brandingProfile = await getOrganisationEmailProviderProfile(null)
    const branding = brandingProfile?.branding || null

    return {
      invitation: {
        id: tenantInviteRow.id,
        tenantId: tenantInviteRow.tenantId,
        email: tenantInviteRow.email,
        role: tenantInviteRow.role,
        status: effectiveStatus,
        expiresAt:
          tenantInviteRow.expiresAt instanceof Date
            ? tenantInviteRow.expiresAt.toISOString()
            : typeof tenantInviteRow.expiresAt === 'number'
              ? new Date(tenantInviteRow.expiresAt).toISOString()
              : new Date(tenantInviteRow.expiresAt).toISOString(),
        invitedBy: tenantInviteRow.invitedByEmail || tenantInviteRow.invitedByName || '',
        createdAt: tenantInviteRow.createdAt.toISOString(),
        branding,
        willCreateOrganization,
        organizationName: organizationData?.name
      },
      tenant: tenantInviteRow.tenantId
        ? {
            id: tenantInviteRow.tenantId,
            name: tenantInviteRow.tenantName ?? 'Tenant',
            type: tenantInviteRow.tenantType
          }
        : null,
      emailExists: Boolean(existingUser),
      hasPassword: Boolean(existingUser?.hasPassword),
      autoAccept: isSessionMatching
    }
  }

  // Fall back to organization invitation (backward compatibility)
  const [row] = await db
    .select({
      id: organizationInvitations.id,
      organizationId: organizationInvitations.organizationId,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      status: organizationInvitations.status,
      token: organizationInvitations.token,
      expiresAt: organizationInvitations.expiresAt,
      createdAt: organizationInvitations.createdAt,
      invitedByUserId: organizationInvitations.invitedByUserId,
      organisationName: organizations.name,
      organisationLogoUrl: organizations.logoUrl,
      invitedByEmail: users.email,
      invitedByName: users.fullName
    })
    .from(organizationInvitations)
    .leftJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
    .leftJoin(users, eq(users.id, organizationInvitations.invitedByUserId))
    .where(eq(organizationInvitations.token, token))

  if (!row) {
    throw createError({ statusCode: 404, message: 'Inbjudan hittades inte.' })
  }

  let effectiveStatus = row.status
  // Handle both Date object and number (milliseconds) from database
  const expiresAtMs =
    row.expiresAt instanceof Date
      ? row.expiresAt.getTime()
      : typeof row.expiresAt === 'number'
        ? row.expiresAt
        : new Date(row.expiresAt).getTime()

  if (effectiveStatus === 'pending' && !isNaN(expiresAtMs) && expiresAtMs < now.getTime()) {
    await db
      .update(organizationInvitations)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(organizationInvitations.id, row.id))
    effectiveStatus = 'expired'
  }

  const normalizedEmail = normalizeEmail(row.email)
  const existingUser = await db
    .select({
      id: users.id,
      hasPassword: users.passwordHash
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)
    .get()

  const auth = await ensureAuthState(event)
  const isSessionMatching =
    Boolean(auth?.user?.email) &&
    normalizeEmail(auth.user.email) === normalizedEmail &&
    effectiveStatus === 'pending'

  const brandingProfile = await getOrganisationEmailProviderProfile(row.organizationId)

  // Prioritera organisationens logoUrl över email provider branding
  // Organisationens logoUrl ska alltid användas om den finns
  const logoUrl = row.organisationLogoUrl || brandingProfile?.branding?.logoUrl || null
  const normalizedLogoUrl = logoUrl ? normalizeLogoUrl(logoUrl) : null

  const branding = normalizedLogoUrl
    ? {
        ...(brandingProfile?.branding ?? {}),
        logoUrl: normalizedLogoUrl
      }
    : brandingProfile?.branding
    ? brandingProfile.branding
    : null

  // Debug logging
  if (import.meta.dev) {
    console.log('[invite] Token:', token)
    console.log('[invite] Organisation ID:', row.organizationId)
    console.log('[invite] Organisation name:', row.organisationName)
    console.log('[invite] Organisation logoUrl (raw):', row.organisationLogoUrl)
    console.log('[invite] Email provider branding logoUrl:', brandingProfile?.branding?.logoUrl)
    console.log('[invite] Final normalized logoUrl:', normalizedLogoUrl)
    console.log('[invite] Final branding object:', JSON.stringify(branding, null, 2))
  }

  return {
    invitation: {
      id: row.id,
      organisationId: row.organizationId,
      email: row.email,
      role: row.role,
      status: effectiveStatus,
      expiresAt:
        row.expiresAt instanceof Date
          ? row.expiresAt.toISOString()
          : typeof row.expiresAt === 'number'
            ? new Date(row.expiresAt).toISOString()
            : new Date(row.expiresAt).toISOString(),
      invitedBy: row.invitedByEmail || row.invitedByName || '',
      createdAt: row.createdAt.toISOString(),
      branding
    },
    organisation: row.organizationId
      ? {
          id: row.organizationId,
          name: row.organisationName ?? 'Organisation'
        }
      : null,
    emailExists: Boolean(existingUser),
    hasPassword: Boolean(existingUser?.hasPassword),
    autoAccept: isSessionMatching
  }
})
