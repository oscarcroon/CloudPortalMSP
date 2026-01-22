import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import {
  organizationInvitations,
  organizationMemberships,
  organizations,
  organizationAuthSettings,
  tenantInvitations,
  tenantMemberships,
  tenants,
  users
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { normalizeEmail } from '~~/server/utils/crypto'
import { requireSession } from '~~/server/utils/session'
import type { OrganizationMemberRole } from '~/types/members'
import { sendInviteAcceptedNotification } from '~~/server/utils/mailer'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, message: 'Saknar inbjudningstoken.' })
  }

  const auth = await requireSession(event)
  const db = getDb()
  const now = new Date()

  // Try tenant invitation first
  const tenantInviteRow = await db
    .select({
      invitation: tenantInvitations,
      tenantName: tenants.name,
      tenantType: tenants.type
    })
    .from(tenantInvitations)
    .leftJoin(tenants, eq(tenants.id, tenantInvitations.tenantId))
    .where(eq(tenantInvitations.token, token))
    .get()

  if (tenantInviteRow?.invitation) {
    const invitation = tenantInviteRow.invitation

    if (invitation.status === 'cancelled') {
      throw createError({ statusCode: 409, message: 'Inbjudan har dragits tillbaka.' })
    }
    if (invitation.status === 'accepted') {
      return { success: true }
    }
    if (now > invitation.expiresAt) {
      await db
        .update(tenantInvitations)
        .set({ status: 'expired', updatedAt: now })
        .where(eq(tenantInvitations.id, invitation.id))
      throw createError({ statusCode: 410, message: 'Inbjudan har gått ut.' })
    }

    const sessionEmail = normalizeEmail(auth.user.email)
    if (sessionEmail !== normalizeEmail(invitation.email)) {
      throw createError({
        statusCode: 403,
        message: 'Du är inloggad med en annan e-postadress än den som bjöds in.'
      })
    }

    // Create tenant membership
    const existingMembership = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, invitation.tenantId),
          eq(tenantMemberships.userId, auth.user.id)
        )
      )
      .get()

    if (existingMembership?.id) {
      await db
        .update(tenantMemberships)
        .set({
          role: invitation.role,
          status: 'active',
          updatedAt: now
        })
        .where(eq(tenantMemberships.id, existingMembership.id))
    } else {
      await db.insert(tenantMemberships).values({
        id: createId(),
        tenantId: invitation.tenantId,
        userId: auth.user.id,
        role: invitation.role,
        includeChildren: false,
        status: 'active',
        createdAt: now,
        updatedAt: now
      })
    }

    // Handle organization creation if organizationData exists
    if (invitation.organizationData) {
      try {
        const organizationData = JSON.parse(invitation.organizationData)
        const organizationId = createId()
        const slugify = (name: string) =>
          name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
        const finalSlug = organizationData.slug || slugify(organizationData.name)

        await db.transaction(async (tx) => {
          await tx.insert(organizations).values({
            id: organizationId,
            name: organizationData.name,
            slug: finalSlug,
            tenantId: invitation.tenantId,
            status: 'active',
            billingEmail: organizationData.billingEmail || null,
            coreId: organizationData.coreId ? organizationData.coreId.toUpperCase() : null,
            defaultRole: 'viewer',
            requireSso: false,
            allowSelfSignup: false
          })

          await tx.insert(organizationAuthSettings).values({
            organizationId,
            idpType: 'none',
            ssoEnforced: false,
            allowLocalLoginForOwners: true
          })

          await tx.insert(organizationMemberships).values({
            id: createId(),
            organizationId,
            userId: auth.user.id,
            role: 'owner' as OrganizationMemberRole,
            status: 'active',
            createdAt: now,
            updatedAt: now
          })
        })

        // Update user defaultOrgId if not set
        if (!auth.user.defaultOrgId) {
          await db
            .update(users)
            .set({ defaultOrgId: organizationId })
            .where(eq(users.id, auth.user.id))
        }
      } catch (error) {
        console.error('[invite] Failed to create organization from tenant invitation', error)
        // Continue anyway - tenant membership is created
      }
    }

    await db
      .update(tenantInvitations)
      .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
      .where(eq(tenantInvitations.id, invitation.id))

    console.info(
      `[audit][invite] ${invitation.email} accepterade tenant-inbjudan till ${invitation.tenantId} som ${invitation.role}`
    )

    return { success: true }
  }

  // Fall back to organization invitation
  const invitationRow = await db
    .select({
      invitation: organizationInvitations,
      invitedByEmail: users.email,
      invitedByName: users.fullName,
      organizationName: organizations.name
    })
    .from(organizationInvitations)
    .leftJoin(users, eq(users.id, organizationInvitations.invitedByUserId))
    .leftJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
    .where(eq(organizationInvitations.token, token))
    .get()

  const invitation = invitationRow?.invitation

  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Inbjudan hittades inte.' })
  }
  if (invitation.status === 'cancelled') {
    throw createError({ statusCode: 409, message: 'Inbjudan har dragits tillbaka.' })
  }
  if (invitation.status === 'accepted') {
    return { success: true }
  }
  if (now > invitation.expiresAt) {
    await db
      .update(organizationInvitations)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(organizationInvitations.id, invitation.id))
    throw createError({ statusCode: 410, message: 'Inbjudan har gått ut.' })
  }

  const sessionEmail = normalizeEmail(auth.user.email)
  if (sessionEmail !== normalizeEmail(invitation.email)) {
    throw createError({
      statusCode: 403,
      message: 'Du är inloggad med en annan e-postadress än den som bjöds in.'
    })
  }

  const membershipSelector = and(
    eq(organizationMemberships.organizationId, invitation.organizationId),
    eq(organizationMemberships.userId, auth.user.id)
  )
  const existingMembership = await db
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(membershipSelector)
    .get()

  if (existingMembership?.id) {
    await db
      .update(organizationMemberships)
      .set({
        role: invitation.role as OrganizationMemberRole,
        status: 'active',
        updatedAt: now
      })
      .where(eq(organizationMemberships.id, existingMembership.id))
  } else {
    await db.insert(organizationMemberships).values({
      id: createId(),
      organizationId: invitation.organizationId,
      userId: auth.user.id,
      role: invitation.role as OrganizationMemberRole,
      status: 'active',
      createdAt: now,
      updatedAt: now
    })
  }

  await db
    .update(organizationInvitations)
    .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
    .where(eq(organizationInvitations.id, invitation.id))

  // Only update defaultOrgId if user doesn't already have one
  if (!auth.user.defaultOrgId) {
    await db
      .update(users)
      .set({
        defaultOrgId: invitation.organizationId
      })
      .where(eq(users.id, auth.user.id))
  }

  if (invitationRow?.invitedByEmail) {
    try {
      await sendInviteAcceptedNotification({
        organizationId: invitation.organizationId,
        organizationName: invitationRow.organizationName ?? `Organization ${invitation.organizationId}`,
        invitedByEmail: invitationRow.invitedByEmail,
        memberEmail: invitation.email,
        memberName: auth.user.fullName ?? auth.user.email,
        role: invitation.role
      })
    } catch (error) {
      console.error('[invite] Failed to notify inviter about acceptance', error)
    }
  }

  console.info(
    `[audit][invite] ${invitation.email} accepterade inbjudan till ${invitation.organizationId} som ${invitation.role}`
  )

  return { success: true }
})


