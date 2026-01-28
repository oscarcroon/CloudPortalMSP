import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import {
  mspOrgDelegationInvitations,
  mspOrgDelegations,
  mspOrgDelegationPermissions,
  modulePermissions,
  organizations,
  users
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { normalizeEmail } from '~~/server/utils/crypto'
import { requirePermission } from '~~/server/utils/rbac'
import { sendDelegationInvitationEmail } from '~~/server/utils/mailer'
import { logUserAction } from '~~/server/utils/audit'
import { createInviteToken } from '~~/server/api/admin/organizations/utils'

const inviteSchema = z.object({
  email: z.string().email(),
  moduleKeys: z.array(z.string()).optional(),
  permissionKeys: z.array(z.string()).min(1, 'At least one permission is required'),
  expiresAt: z.number().nullable().optional(), // When the delegation should expire (not the invite)
  note: z.string().max(200).nullable().optional()
})

const INVITE_VALIDITY_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  // Require org:manage permission for the organization
  const { auth } = await requirePermission(event, 'org:manage', orgId)

  const db = getDb()
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  const payload = inviteSchema.parse(await readBody(event))
  const normalizedEmail = normalizeEmail(payload.email)
  const permissionKeys = Array.from(new Set(payload.permissionKeys)).filter(Boolean)

  // Validate permission keys exist
  const validKeys = await db.select({ permissionKey: modulePermissions.permissionKey }).from(modulePermissions)
  const validSet = new Set(validKeys.map((p) => p.permissionKey))
  for (const key of permissionKeys) {
    if (!validSet.has(key)) {
      throw createError({ statusCode: 400, message: `Unknown permission: ${key}` })
    }
  }

  const invitedByLabel = auth.user.fullName?.trim() || auth.user.email

  // Check if user already exists
  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail))
  
  if (existingUser) {
    // User exists - cancel any pending invites for this email (cleanup)
    await db
      .update(mspOrgDelegationInvitations)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(mspOrgDelegationInvitations.orgId, org.id),
          eq(mspOrgDelegationInvitations.email, normalizedEmail),
          eq(mspOrgDelegationInvitations.status, 'pending')
        )
      )
    
    // Check if they already have an active (non-revoked, non-expired) delegation
    const now = new Date()
    const existingDelegations = await db
      .select()
      .from(mspOrgDelegations)
      .where(
        and(
          eq(mspOrgDelegations.orgId, org.id),
          eq(mspOrgDelegations.subjectId, existingUser.id)
        )
      )
    
    // Find active delegation (not revoked and not expired)
    const activeDelegation = existingDelegations.find(d => {
      if (d.revokedAt) return false
      if (d.expiresAt && d.expiresAt <= now) return false
      return true
    })

    // For existing users, we can create the delegation directly (they can log in)
    // But we still send them a notification email
    const delegationId = createId()
    
    await db.insert(mspOrgDelegations).values({
      id: delegationId,
      orgId: org.id,
      subjectType: 'user',
      subjectId: existingUser.id,
      createdBy: auth.user.id,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      note: payload.note ?? null,
      revokedAt: null,
      revokedBy: null,
      createdAt: now,
      updatedAt: now
    })

    await db.insert(mspOrgDelegationPermissions).values(
      permissionKeys.map((permissionKey) => ({
        delegationId,
        permissionKey
      }))
    )

    // Log the action
    await logUserAction(event, 'DELEGATION_CREATED', {
      targetUserId: existingUser.id,
      targetUserEmail: existingUser.email,
      organizationId: org.id,
      delegationId,
      permissionKeys,
      existingUser: true
    }, existingUser.id)

    // Send notification email to existing user about their new delegation
    try {
      await sendDelegationInvitationEmail({
        organizationId: org.id,
        organizationName: org.name,
        invitedBy: invitedByLabel,
        permissionCount: permissionKeys.length,
        to: existingUser.email,
        expiresAt: payload.expiresAt ?? Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year if no expiry
        token: null, // No token needed - they can log in directly
        note: payload.note,
        organizationLogo: org.logoUrl ?? null
      })
    } catch (error) {
      console.error('[delegation/invite] Failed to send notification email to existing user:', error)
      // Don't fail - delegation is created
    }

    return {
      type: 'delegation' as const,
      userId: existingUser.id,
      userEmail: existingUser.email,
      userFullName: existingUser.fullName,
      delegationId,
      permissionKeys,
      expiresAt: payload.expiresAt ?? null,
      note: payload.note ?? null,
      message: activeDelegation 
        ? 'New delegation created for existing user (they already had an active delegation)'
        : 'Delegation created for existing user'
    }
  }

  // User doesn't exist - create an invitation
  // Check for existing pending invitation
  const [existingInvite] = await db
    .select()
    .from(mspOrgDelegationInvitations)
    .where(
      and(
        eq(mspOrgDelegationInvitations.orgId, org.id),
        eq(mspOrgDelegationInvitations.email, normalizedEmail),
        eq(mspOrgDelegationInvitations.status, 'pending')
      )
    )

  if (existingInvite) {
    throw createError({ 
      statusCode: 409, 
      message: 'Det finns redan en väntande inbjudan för denna e-postadress.' 
    })
  }

  // Create invitation
  const token = createInviteToken()
  const inviteExpiresAt = Date.now() + INVITE_VALIDITY_MS
  const inviteId = createId()

  await db.insert(mspOrgDelegationInvitations).values({
    id: inviteId,
    orgId: org.id,
    email: normalizedEmail,
    token,
    permissionKeys: JSON.stringify(permissionKeys),
    note: payload.note ?? null,
    status: 'pending',
    invitedByUserId: auth.user.id,
    expiresAt: new Date(inviteExpiresAt),
    delegationExpiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null
  })

  // Send invitation email
  try {
    await sendDelegationInvitationEmail({
      organizationId: org.id,
      organizationName: org.name,
      invitedBy: invitedByLabel,
      permissionCount: permissionKeys.length,
      to: normalizedEmail,
      expiresAt: inviteExpiresAt,
      token,
      note: payload.note,
      organizationLogo: org.logoUrl ?? null
    })
  } catch (error) {
    console.error('[delegation/invite] Failed to send invitation email:', error)
    // Don't fail the request - invitation is created
  }

  // Log the action
  await logUserAction(event, 'DELEGATION_INVITE_SENT', {
    targetUserEmail: normalizedEmail,
    organizationId: org.id,
    inviteId,
    permissionKeys
  })

  return {
    type: 'invitation' as const,
    inviteId,
    email: normalizedEmail,
    permissionKeys,
    expiresAt: inviteExpiresAt,
    delegationExpiresAt: payload.expiresAt ?? null,
    note: payload.note ?? null,
    message: 'Invitation sent to new user'
  }
})
