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
import { requireSuperAdmin } from '../../../../../utils/rbac'
import {
  createInviteToken,
  parseOrgParam,
  requireOrganizationByIdentifier
} from '../../utils'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(rbacRoles).optional()
})

const INVITE_VALIDITY_MS = 1000 * 60 * 60 * 24 * 14

export default defineEventHandler(async (event) => {
  const auth = await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const payload = inviteSchema.parse(await readBody(event))
  const normalizedEmail = normalizeEmail(payload.email)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  const result = isSqlite
    ? db.transaction((tx) => {
        const existingUser =
          tx.select().from(users).where(eq(users.email, normalizedEmail)).get() ?? null
        const targetRole = payload.role ?? organization.defaultRole

        if (existingUser) {
          const membership =
            tx
              .select()
              .from(organizationMemberships)
              .where(
                and(
                  eq(organizationMemberships.organizationId, organization.id),
                  eq(organizationMemberships.userId, existingUser.id)
                )
              )
              .get() ?? null

          if (membership) {
            if (membership.status === 'active') {
              throw createError({
                statusCode: 409,
                message: 'Användaren är redan medlem i organisationen.'
              })
            }

            tx.update(organizationMemberships)
              .set({
                status: 'active',
                role: targetRole
              })
              .where(eq(organizationMemberships.id, membership.id))
              .run()

            return { type: 'member', membershipId: membership.id }
          }

          const membershipId = createId()
          tx.insert(organizationMemberships)
            .values({
              id: membershipId,
              organizationId: organization.id,
              userId: existingUser.id,
              role: targetRole,
              status: 'active'
            })
            .run()
          return { type: 'member', membershipId }
        }

        const token = createInviteToken()
        const expiresAt = Date.now() + INVITE_VALIDITY_MS
        const inviteId = createId()
        tx.insert(organizationInvitations)
          .values({
            id: inviteId,
            organizationId: organization.id,
            email: normalizedEmail,
            role: targetRole,
            token,
            status: 'pending',
            invitedByUserId: auth.user.id,
            expiresAt
          })
          .run()

        console.info(
          `[invite] pending invite for ${normalizedEmail} to ${organization.slug} token=${token}`
        )

        return { type: 'invite', inviteId }
      })
    : await db.transaction(async (tx) => {
        const [existingUser] = await tx.select().from(users).where(eq(users.email, normalizedEmail))
        const targetRole = payload.role ?? organization.defaultRole

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
          })
          return { type: 'member', membershipId }
        }

        const token = createInviteToken()
        const expiresAt = Date.now() + INVITE_VALIDITY_MS
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
        })

        console.info(
          `[invite] pending invite for ${normalizedEmail} to ${organization.slug} token=${token}`
        )

        return { type: 'invite', inviteId }
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

