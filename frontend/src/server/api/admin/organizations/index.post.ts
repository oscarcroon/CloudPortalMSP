import { createId } from '@paralleldrive/cuid2'
import { randomBytes } from 'node:crypto'
import { createError, defineEventHandler, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { rbacRoles } from '~/constants/rbac'
import { organizations, organizationMemberships, users } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { hashPassword, normalizeEmail } from '../../../utils/crypto'
import { slugify } from '../../../utils/auth'
import { requireSuperAdmin } from '../../../utils/rbac'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(slugRegex, 'Slug may only contain lowercase letters, numbers and dashes.')
    .optional(),
  billingEmail: z.string().email().optional(),
  enforceSso: z.boolean().optional(),
  selfSignupEnabled: z.boolean().optional(),
  defaultRole: z.enum(rbacRoles).optional(),
  owner: z.object({
    email: z.string().email(),
    fullName: z.string().min(2).max(120).optional(),
    password: z.string().min(10).max(128).optional()
  })
})

const generatePassword = () => randomBytes(12).toString('base64url')

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const payload = createOrgSchema.parse(await readBody(event))
  const db = getDb()

  const normalizedOwnerEmail = normalizeEmail(payload.owner.email)

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedOwnerEmail))

  if (existingUser && payload.owner.password) {
    throw createError({
      statusCode: 400,
      message: 'Owner user already exists; omit password or reset credentials separately.'
    })
  }

  const resolvedPassword =
    !existingUser && !payload.owner.password ? generatePassword() : payload.owner.password
  const passwordHash = resolvedPassword ? await hashPassword(resolvedPassword) : null

  const organizationId = createId()
  const ownerUserId = existingUser?.id ?? createId()

  try {
    await db.transaction(async (tx) => {
      const organizationValues: typeof organizations.$inferInsert = {
        id: organizationId,
        name: payload.name,
        slug: payload.slug ?? slugify(payload.name),
        status: 'active',
        billingEmail: payload.billingEmail,
        enforceSso: payload.enforceSso ?? false,
        selfSignupEnabled: payload.selfSignupEnabled ?? false,
        defaultRole: payload.defaultRole ?? 'viewer'
      }

      await tx.insert(organizations).values(organizationValues)

      if (!existingUser) {
        await tx.insert(users).values({
          id: ownerUserId,
          email: normalizedOwnerEmail,
          passwordHash,
          fullName: payload.owner.fullName,
          status: 'active',
          defaultOrgId: organizationId
        })
      } else {
        const updates: Partial<typeof users.$inferInsert> = {}
        if (!existingUser.defaultOrgId) {
          updates.defaultOrgId = organizationId
        }
        if (payload.owner.fullName && !existingUser.fullName) {
          updates.fullName = payload.owner.fullName
        }
        if (Object.keys(updates).length) {
          await tx.update(users).set(updates).where(eq(users.id, existingUser.id))
        }
      }

      const membershipExists = await tx
        .select({ id: organizationMemberships.id })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, ownerUserId)
          )
        )

      if (!membershipExists.length) {
        await tx.insert(organizationMemberships).values({
          id: createId(),
          organizationId,
          userId: ownerUserId,
          role: 'owner'
        })
      }
    })
  } catch (error: any) {
    if (
      typeof error?.message === 'string' &&
      (error.message.includes('organizations_slug_idx') ||
        error.message.includes('UNIQUE constraint failed: organizations.slug'))
    ) {
      throw createError({ statusCode: 409, message: 'Organization slug already exists' })
    }
    if (
      typeof error?.message === 'string' &&
      error.message.includes('users_email_idx') &&
      !existingUser
    ) {
      throw createError({ statusCode: 409, message: 'User email already exists' })
    }
    throw error
  }

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))

  if (!organization) {
    throw createError({ statusCode: 500, message: 'Organization not found after creation' })
  }

  return {
    organization,
    owner: {
      id: ownerUserId,
      email: normalizedOwnerEmail,
      fullName: payload.owner.fullName ?? existingUser?.fullName ?? null
    },
    generatedPassword: !payload.owner.password && !existingUser ? resolvedPassword : null
  }
})

