import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { organizationInvitations, organizations, tenantInvitations, tenants, users } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { ensureAuthState } from '~~/server/utils/session'
import { normalizeEmail } from '~~/server/utils/crypto'
import { getOrganizationEmailProviderProfile } from '~~/server/utils/emailProvider'
import { normalizeLogoUrl } from '~/utils/logo'

const cleanOrganizationName = (value?: string | null): string => {
  if (!value) return ''
  let normalized = value.trim()
  if (!normalized) return ''

  const tempPrefix = /^temp\s+org\s+for\s+/i
  if (tempPrefix.test(normalized)) {
    normalized = normalized.replace(tempPrefix, '').trim()
  }

  const systemSuffix = /\s+-\s*system$/i
  if (systemSuffix.test(normalized)) {
    normalized = normalized.replace(systemSuffix, '').trim()
  }

  return normalized
}

const resolveOrganizationName = (primary?: string | null, fallback?: string | null): string | null => {
  const primaryResult = cleanOrganizationName(primary)
  if (primaryResult) {
    return primaryResult
  }
  const fallbackResult = cleanOrganizationName(fallback)
  return fallbackResult || null
}

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

    const auth = (await ensureAuthState(event)) ?? null
    const authEmail = auth?.user?.email ? normalizeEmail(auth.user.email as string) : null
    const isSessionMatching =
      Boolean(authEmail) && authEmail === normalizedEmail && effectiveStatus === 'pending'

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
    const brandingProfile = await getOrganizationEmailProviderProfile('')
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
      tenantId: organizations.tenantId,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      status: organizationInvitations.status,
      token: organizationInvitations.token,
      expiresAt: organizationInvitations.expiresAt,
      createdAt: organizationInvitations.createdAt,
      invitedByUserId: organizationInvitations.invitedByUserId,
      organizationName: organizations.name,
      organizationLogoUrl: organizations.logoUrl,
      tenantName: tenants.name,
      tenantType: tenants.type,
      invitedByEmail: users.email,
      invitedByName: users.fullName
    })
    .from(organizationInvitations)
    .leftJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
    .leftJoin(tenants, eq(tenants.id, organizations.tenantId))
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
    const authEmail = auth?.user?.email ? normalizeEmail(auth.user.email as string) : null
    const isSessionMatching =
      Boolean(authEmail) && authEmail === normalizedEmail && effectiveStatus === 'pending'

  const brandingProfile = await getOrganizationEmailProviderProfile(row.organizationId)

  // Prioritera organisationens logoUrl över email provider branding
  // Organisationens logoUrl ska alltid användas om den finns
  const logoUrl = row.organizationLogoUrl || brandingProfile?.branding?.logoUrl || null
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
    console.log('[invite] Organization ID:', row.organizationId)
    console.log('[invite] Organization name:', row.organizationName)
    console.log('[invite] Organization logoUrl (raw):', row.organizationLogoUrl)
    console.log('[invite] Email provider branding logoUrl:', brandingProfile?.branding?.logoUrl)
    console.log('[invite] Final normalized logoUrl:', normalizedLogoUrl)
    console.log('[invite] Final branding object:', JSON.stringify(branding, null, 2))
  }

  const friendlyOrganizationName =
    resolveOrganizationName(row.organizationName, row.tenantName ?? null) ?? row.organizationName ?? null
  const invitedByLabel =
    row.invitedByName?.trim() ||
    row.invitedByEmail?.trim() ||
    (row.tenantName ? `${row.tenantName} (System)` : 'System')

  return {
    invitation: {
      id: row.id,
      organizationId: row.organizationId,
      email: row.email,
      role: row.role,
      status: effectiveStatus,
      expiresAt:
        row.expiresAt instanceof Date
          ? row.expiresAt.toISOString()
          : typeof row.expiresAt === 'number'
            ? new Date(row.expiresAt).toISOString()
            : new Date(row.expiresAt).toISOString(),
      invitedBy: invitedByLabel,
      createdAt: row.createdAt.toISOString(),
      branding,
      organizationName: friendlyOrganizationName
    },
    organization: row.organizationId
      ? {
          id: row.organizationId,
          name: friendlyOrganizationName ?? 'Organization'
        }
      : null,
    tenant: row.tenantId
      ? {
          id: row.tenantId,
          name: row.tenantName ?? 'Tenant',
          type: row.tenantType ?? null
        }
      : null,
    emailExists: Boolean(existingUser),
    hasPassword: Boolean(existingUser?.hasPassword),
    autoAccept: isSessionMatching
  }
})
