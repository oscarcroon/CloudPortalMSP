import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { organizationInvitations, organizations, users } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { ensureAuthState } from '~/server/utils/session'
import { normalizeEmail } from '~/server/utils/crypto'
import { getOrganisationEmailProviderProfile } from '~/server/utils/emailProvider'
import { normalizeLogoUrl } from '~/utils/logo'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, message: 'Saknar inbjudningstoken.' })
  }

  const db = getDb()

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

  const now = new Date()
  let effectiveStatus = row.status
  if (effectiveStatus === 'pending' && now > row.expiresAt) {
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
      expiresAt: row.expiresAt.toISOString(),
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


