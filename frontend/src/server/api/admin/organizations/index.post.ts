import { createId } from '@paralleldrive/cuid2'
import { createError, defineEventHandler, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { rbacRoles } from '~/constants/rbac'
import {
  organizationAuthSettings,
  organizationMemberships,
  organizations,
  users
} from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { normalizeEmail } from '../../../utils/crypto'
import { slugify } from '../../../utils/auth'
import { requireSuperAdmin } from '../../../utils/rbac'
import { ensureOrganizationAuthSettings, serializeAuthSettings, slugRegex } from './utils'

const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(slugRegex, 'Slug may only contain lowercase letters, numbers och bindestreck.')
    .optional(),
  billingEmail: z.string().email().optional(),
  requireSso: z.boolean().optional(),
  allowSelfSignup: z.boolean().optional(),
  defaultRole: z.enum(rbacRoles).optional(),
  owner: z.object({
    email: z.string().email(),
    fullName: z.string().min(2).max(120).optional()
  })
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const payload = createOrgSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  const normalizedOwnerEmail = normalizeEmail(payload.owner.email)

  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedOwnerEmail))

  const organizationId = createId()
  const ownerUserId = existingUser?.id ?? createId()

  try {
    if (isSqlite) {
      db.transaction((tx) => {
        const organizationValues: typeof organizations.$inferInsert = {
          id: organizationId,
          name: payload.name,
          slug: payload.slug ?? slugify(payload.name),
          status: 'active',
          billingEmail: payload.billingEmail,
          requireSso: payload.requireSso ?? false,
          allowSelfSignup: payload.allowSelfSignup ?? false,
          defaultRole: payload.defaultRole ?? 'viewer'
        }

        tx.insert(organizations).values(organizationValues).run()
        tx.insert(organizationAuthSettings)
          .values({
            organizationId,
            idpType: 'none',
            ssoEnforced: organizationValues.requireSso ?? false,
            allowLocalLoginForOwners: true
          })
          .run()

        if (!existingUser) {
          tx.insert(users)
            .values({
              id: ownerUserId,
              email: normalizedOwnerEmail,
              passwordHash: null,
              fullName: payload.owner.fullName,
              status: 'active',
              defaultOrgId: organizationId,
              forcePasswordReset: 1
            })
            .run()
        } else {
          const updates: Partial<typeof users.$inferInsert> = {}
          if (!existingUser.defaultOrgId) {
            updates.defaultOrgId = organizationId
          }
          if (payload.owner.fullName && !existingUser.fullName) {
            updates.fullName = payload.owner.fullName
          }
          if (Object.keys(updates).length) {
            tx.update(users).set(updates).where(eq(users.id, existingUser.id)).run()
          }
        }

        const membershipExists = tx
          .select({ id: organizationMemberships.id })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, organizationId),
              eq(organizationMemberships.userId, ownerUserId)
            )
          )
          .all()

        if (!membershipExists.length) {
          tx.insert(organizationMemberships)
            .values({
              id: createId(),
              organizationId,
              userId: ownerUserId,
              role: 'owner',
              status: 'active'
            })
            .run()
        }
      })
    } else {
      await db.transaction(async (tx) => {
        const organizationValues: typeof organizations.$inferInsert = {
          id: organizationId,
          name: payload.name,
          slug: payload.slug ?? slugify(payload.name),
          status: 'active',
          billingEmail: payload.billingEmail,
          requireSso: payload.requireSso ?? false,
          allowSelfSignup: payload.allowSelfSignup ?? false,
          defaultRole: payload.defaultRole ?? 'viewer'
        }

        await tx.insert(organizations).values(organizationValues)
        await tx.insert(organizationAuthSettings).values({
          organizationId,
          idpType: 'none',
          ssoEnforced: organizationValues.requireSso ?? false,
          allowLocalLoginForOwners: true
        })

        if (!existingUser) {
          await tx.insert(users).values({
            id: ownerUserId,
            email: normalizedOwnerEmail,
            passwordHash: null,
            fullName: payload.owner.fullName,
            status: 'active',
            defaultOrgId: organizationId,
            forcePasswordReset: 1
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
            role: 'owner',
            status: 'active'
          })
        }
      })
    }
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
    throw createError({ statusCode: 500, message: 'Organisationen kunde inte skapas korrekt.' })
  }

  const authSettings = await ensureOrganizationAuthSettings(db, organizationId)

  return {
    organization,
    authSettings: serializeAuthSettings(authSettings),
    owner: {
      id: ownerUserId,
      email: normalizedOwnerEmail,
      fullName: payload.owner.fullName ?? existingUser?.fullName ?? null
    }
  }
})

