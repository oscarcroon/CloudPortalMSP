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

  const invitation = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.token, token))
    .get()

  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Inbjudan hittades inte.' })
  }
  if (invitation.status === 'cancelled') {
    throw createError({ statusCode: 409, message: 'Inbjudan har dragits tillbaka.' })
  }
  if (invitation.status === 'accepted') {
    throw createError({ statusCode: 409, message: 'Inbjudan är redan accepterad.' })
  }
  const now = new Date()
  if (now > invitation.expiresAt) {
    await db
      .update(organizationInvitations)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(organizationInvitations.id, invitation.id))
    throw createError({ statusCode: 410, message: 'Inbjudan har gått ut.' })
  }

  const normalizedEmail = normalizeEmail(invitation.email)
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .get()

  if (existingUser) {
    throw createError({
      statusCode: 409,
      message: 'Det finns redan ett konto för denna e-postadress. Logga in istället.'
    })
  }

  const passwordHash = await hashPassword(payload.password)
  const userId = createId()
  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    fullName: payload.fullName,
    status: 'active',
    passwordHash,
    defaultOrgId: invitation.organizationId
  })

  await db.insert(organizationMemberships).values({
    id: createId(),
    organizationId: invitation.organizationId,
    userId,
    role: invitation.role as OrganizationMemberRole,
    status: 'active',
    createdAt: now,
    updatedAt: now
  })

  await db
    .update(organizationInvitations)
    .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
    .where(eq(organizationInvitations.id, invitation.id))

  await createSession(event, userId, invitation.organizationId)

  return { success: true }
})


