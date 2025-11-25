import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z, ZodError } from 'zod'
import {
  organizationInvitations,
  organizationMemberships,
  users
} from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { hashPassword, normalizeEmail } from '~/server/utils/crypto'
import { createSession } from '~/server/utils/session'
import { passwordSchema } from '~/server/utils/password'
import type { OrganizationMemberRole } from '~/types/members'
import { formatZodErrorAsList } from '~/server/utils/errors'

const registerSchema = z.object({
  password: passwordSchema,
  fullName: z
    .string()
    .trim()
    .min(4, 'Namnet måste vara minst 4 tecken.')
    .max(120, 'Namnet får vara högst 120 tecken.')
    .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, {
      message: 'Ange både för- och efternamn.'
    })
})

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, message: 'Saknar inbjudningstoken.' })
  }

  let payload: z.infer<typeof registerSchema>
  try {
    payload = registerSchema.parse(await readBody(event))
  } catch (error) {
    if (error instanceof ZodError) {
      throw createError({
        statusCode: 400,
        message: formatZodErrorAsList(error).join('. '),
        data: {
          errors: formatZodErrorAsList(error)
        }
      })
    }
    throw error
  }
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  // Get invitation
  const invitationResult = isSqlite
    ? await (db as any)
        .select()
        .from(organizationInvitations)
        .where(eq(organizationInvitations.token, token))
        .get()
    : await (db as any)
        .select()
        .from(organizationInvitations)
        .where(eq(organizationInvitations.token, token))
        .then((rows: any[]) => rows[0] ?? null)

  if (!invitationResult) {
    throw createError({ statusCode: 404, message: 'Inbjudan hittades inte.' })
  }
  const invitation = invitationResult
  if (invitation.status === 'cancelled') {
    throw createError({ statusCode: 409, message: 'Inbjudan har dragits tillbaka.' })
  }
  if (invitation.status === 'accepted') {
    throw createError({ statusCode: 409, message: 'Inbjudan är redan accepterad.' })
  }
  const now = new Date()
  if (now > invitation.expiresAt) {
    await (db as any)
      .update(organizationInvitations)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(organizationInvitations.id, invitation.id))
    throw createError({ statusCode: 410, message: 'Inbjudan har gått ut.' })
  }

  const normalizedEmail = normalizeEmail(invitation.email)
  
  // Check if user exists
  const userResult = isSqlite
    ? await (db as any)
        .select({ 
          id: users.id, 
          passwordHash: users.passwordHash,
          fullName: users.fullName,
          status: users.status
        })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .get()
    : await (db as any)
        .select({ 
          id: users.id, 
          passwordHash: users.passwordHash,
          fullName: users.fullName,
          status: users.status
        })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .then((rows: any[]) => rows[0] ?? null)

  const existingUser = userResult

  // If user exists and has password, they need to log in instead
  if (existingUser && existingUser.passwordHash) {
    throw createError({
      statusCode: 409,
      message: 'Det finns redan ett konto för denna e-postadress. Logga in istället.'
    })
  }

  const passwordHash = await hashPassword(payload.password)
  
  // If user exists but has no password, update the existing user
  if (existingUser) {
    if (isSqlite) {
      await (db as any)
        .update(users)
        .set({
          passwordHash,
          fullName: payload.fullName || existingUser.fullName,
          defaultOrgId: invitation.organizationId,
          status: existingUser.status || 'active',
          forcePasswordReset: 0,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null
        })
        .where(eq(users.id, existingUser.id))
        .run()
    } else {
      await (db as any)
        .update(users)
        .set({
          passwordHash,
          fullName: payload.fullName || existingUser.fullName,
          defaultOrgId: invitation.organizationId,
          status: existingUser.status || 'active',
          forcePasswordReset: 0,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null
        })
        .where(eq(users.id, existingUser.id))
    }
    
    const userId = existingUser.id
    
    // Check if membership already exists
    const membershipResult = isSqlite
      ? await (db as any)
          .select({ id: organizationMemberships.id })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, invitation.organizationId),
              eq(organizationMemberships.userId, userId)
            )
          )
          .get()
      : await (db as any)
          .select({ id: organizationMemberships.id })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, invitation.organizationId),
              eq(organizationMemberships.userId, userId)
            )
          )
          .then((rows: any[]) => rows[0] ?? null)

    const existingMembership = membershipResult
    
    if (!existingMembership) {
      if (isSqlite) {
        await (db as any).insert(organizationMemberships).values({
          id: createId(),
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role as OrganizationMemberRole,
          status: 'active',
          createdAt: now,
          updatedAt: now
        }).run()
      } else {
        await (db as any).insert(organizationMemberships).values({
          id: createId(),
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role as OrganizationMemberRole,
          status: 'active',
          createdAt: now,
          updatedAt: now
        })
      }
    } else {
      // Update existing membership to active if it was suspended/invited
      if (isSqlite) {
        await (db as any)
          .update(organizationMemberships)
          .set({
            role: invitation.role as OrganizationMemberRole,
            status: 'active',
            updatedAt: now
          })
          .where(eq(organizationMemberships.id, existingMembership.id))
          .run()
      } else {
        await (db as any)
          .update(organizationMemberships)
          .set({
            role: invitation.role as OrganizationMemberRole,
            status: 'active',
            updatedAt: now
          })
          .where(eq(organizationMemberships.id, existingMembership.id))
      }
    }

    if (isSqlite) {
      await (db as any)
        .update(organizationInvitations)
        .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
        .where(eq(organizationInvitations.id, invitation.id))
        .run()
    } else {
      await (db as any)
        .update(organizationInvitations)
        .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
        .where(eq(organizationInvitations.id, invitation.id))
    }

    await createSession(event, userId, invitation.organizationId)

    return { success: true }
  }

  // Create new user
  const userId = createId()
  if (isSqlite) {
    await (db as any).insert(users).values({
      id: userId,
      email: normalizedEmail,
      fullName: payload.fullName,
      status: 'active',
      passwordHash,
      defaultOrgId: invitation.organizationId,
      forcePasswordReset: 0
    }).run()

    await (db as any).insert(organizationMemberships).values({
      id: createId(),
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role as OrganizationMemberRole,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }).run()

    await (db as any)
      .update(organizationInvitations)
      .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
      .where(eq(organizationInvitations.id, invitation.id))
      .run()
  } else {
    await (db as any).insert(users).values({
      id: userId,
      email: normalizedEmail,
      fullName: payload.fullName,
      status: 'active',
      passwordHash,
      defaultOrgId: invitation.organizationId,
      forcePasswordReset: 0
    })

    await (db as any).insert(organizationMemberships).values({
      id: createId(),
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role as OrganizationMemberRole,
      status: 'active',
      createdAt: now,
      updatedAt: now
    })

    await (db as any)
      .update(organizationInvitations)
      .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
      .where(eq(organizationInvitations.id, invitation.id))
  }

  await createSession(event, userId, invitation.organizationId)

  return { success: true }
})
