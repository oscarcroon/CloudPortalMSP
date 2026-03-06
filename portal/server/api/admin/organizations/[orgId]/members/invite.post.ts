import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { rbacRoles } from '~/constants/rbac'
import {
  organizationInvitations,
  organizationMemberships,
  users
} from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { normalizeEmail } from '../../../../../utils/crypto'
import {
  createInviteToken,
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess
} from '../../utils'
import { describeEmailSendError } from '~~/server/utils/emailTest'
import { sendInvitationEmail } from '~~/server/utils/mailer'
import { logUserAction } from '../../../../../utils/audit'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(rbacRoles).optional(),
  directAdd: z.boolean().optional()
})

const INVITE_VALIDITY_MS = 1000 * 60 * 60 * 24 * 14

type OrgMemberRole = NonNullable<typeof organizationMemberships.$inferInsert['role']>

type InviteTransactionResult =
  | {
      type: 'member'
      membershipId: string
    }
  | {
      type: 'invite'
      inviteId: string
      token: string
      expiresAt: number
      email: string
      role: OrgMemberRole
    }

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const payload = inviteSchema.parse(await readBody(event))
  const normalizedEmail = normalizeEmail(payload.email)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - allows superadmins and tenant admins
  const { auth } = await requireOrganizationManageAccess(event, organization)
  const allowDirectAdd = Boolean(organization.requireSso)
  const invitedByLabel = auth.user.fullName?.trim() || auth.user.email
  if (payload.directAdd && !allowDirectAdd) {
    throw createError({
      statusCode: 400,
      message: 'Direktaktivering kräver att organisationen har SSO.'
    })
  }

  const result: InviteTransactionResult = await db.transaction(async (tx) => {
    const [existingUser] = await tx.select().from(users).where(eq(users.email, normalizedEmail))
    const targetRole: OrgMemberRole =
      (payload.role ?? organization.defaultRole ?? 'member') as OrgMemberRole
    const shouldDirectAdd = Boolean(payload.directAdd && allowDirectAdd)

    if (existingUser) {
      const [membership] = await tx
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organization.id),
            eq(organizationMemberships.userId, existingUser.id)
          )
        )

      if (membership) {
        if (membership.status === 'active') {
          throw createError({
            statusCode: 409,
            message: 'Användaren är redan medlem i organisationen.'
          })
        }

        await tx
          .update(organizationMemberships)
          .set({
            status: 'active',
            role: targetRole
          })
          .where(eq(organizationMemberships.id, membership.id))

        return { type: 'member', membershipId: membership.id }
      }

      const membershipId = createId()
      await tx.insert(organizationMemberships).values({
        id: membershipId,
        organizationId: organization.id,
        userId: existingUser.id,
        role: targetRole,
        status: 'active'
      } satisfies typeof organizationMemberships.$inferInsert)
      return { type: 'member', membershipId }
    }

    if (shouldDirectAdd) {
      const userId = createId()
      await tx.insert(users).values({
        id: userId,
        email: normalizedEmail,
        status: 'active',
        fullName: null,
        passwordHash: null,
        defaultOrgId: organization.id
      })

      const membershipId = createId()
      await tx.insert(organizationMemberships).values({
        id: membershipId,
        organizationId: organization.id,
        userId,
        role: targetRole,
        status: 'active'
      } satisfies typeof organizationMemberships.$inferInsert)
      return { type: 'member', membershipId }
    }

    const token = createInviteToken()
    const expiresAtMs = Date.now() + INVITE_VALIDITY_MS
    const expiresAt = new Date(expiresAtMs)
    const inviteId = createId()
    await tx.insert(organizationInvitations).values({
      id: inviteId,
      organizationId: organization.id,
      email: normalizedEmail,
      role: targetRole,
      token,
      status: 'pending',
      invitedByUserId: auth.user.id,
      expiresAt
    } satisfies typeof organizationInvitations.$inferInsert)

    console.info(
      `[invite] pending invite for ${normalizedEmail} to ${organization.slug} token=${token}`
    )

    return {
      type: 'invite',
      inviteId,
      token,
      expiresAt: expiresAtMs,
      email: normalizedEmail,
      role: targetRole
    }
  })

  if (result.type === 'member') {
    const [member] = await db
      .select({
        membershipId: organizationMemberships.id,
        userId: users.id,
        email: users.email,
        fullName: users.fullName,
        role: organizationMemberships.role,
        status: organizationMemberships.status,
        addedAt: organizationMemberships.createdAt
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(eq(organizationMemberships.id, result.membershipId))

    if (!member) {
      throw createError({ statusCode: 500, message: 'Medlemmen kunde inte läsas efter uppdatering.' })
    }

    // Log audit event for direct add
    await logUserAction(event, 'USER_INVITED', {
      targetUserId: member.userId,
      targetUserEmail: member.email,
      organizationId: organization.id,
      role: member.role,
      directAdd: true
    }, member.userId)

    return {
      member: {
        membershipId: member.membershipId,
        userId: member.userId,
        email: member.email,
        fullName: member.fullName,
        role: member.role,
        status: member.status,
        addedAt: member.addedAt
      }
    }
  }

  const [invite] = await db
    .select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      status: organizationInvitations.status,
      invitedAt: organizationInvitations.createdAt,
      expiresAt: organizationInvitations.expiresAt
    })
    .from(organizationInvitations)
    .where(eq(organizationInvitations.id, result.inviteId))

  if (!invite) {
    throw createError({ statusCode: 500, message: 'Inbjudan kunde inte skapas korrekt.' })
  }

  try {
    await sendInvitationEmail({
      organizationId: organization.id,
      organizationName: organization.name,
      invitedBy: invitedByLabel,
      role: result.role,
      to: result.email,
      expiresAt: result.expiresAt,
      token: result.token,
      organizationLogo: organization.logoUrl ?? null
    })
  } catch (error) {
    console.error('[invite] Failed to send invitation email', error)
    throw createError({
      statusCode: 502,
      message: `Inbjudan skapades men mejlet kunde inte skickas. ${describeEmailSendError(error)}`
    })
  }

  // Log audit event for invitation
  await logUserAction(event, 'USER_INVITED', {
    targetUserEmail: result.email,
    organizationId: organization.id,
    role: result.role,
    inviteId: invite.id,
    directAdd: false
  })

  return {
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      invitedAt: invite.invitedAt,
      expiresAt: invite.expiresAt,
      invitedBy: {
        id: auth.user.id,
        email: auth.user.email,
        fullName: auth.user.fullName
      }
    }
  }
})

