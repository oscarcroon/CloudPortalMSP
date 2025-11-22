import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { rbacRoles } from '~/constants/rbac'
import {
  organizationAuthSettings,
  organizations
} from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireSuperAdmin } from '../../../../utils/rbac'
import {
  buildOrganizationDetailPayload,
  ensureOrganizationAuthSettings,
  parseOrgParam,
  requireOrganizationByIdentifier,
  slugRegex
} from '../utils'

const updateSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    slug: z
      .string()
      .min(2)
      .max(120)
      .regex(slugRegex, 'Slug måste vara lowercase och får endast innehålla bindestreck.')
      .optional(),
    billingEmail: z.union([z.string().email(), z.literal(null), z.literal('')]).optional(),
    defaultRole: z.enum(rbacRoles).optional(),
    requireSso: z.boolean().optional(),
    allowSelfSignup: z.boolean().optional()
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.slug !== undefined ||
      payload.billingEmail !== undefined ||
      payload.defaultRole !== undefined ||
      payload.requireSso !== undefined ||
      payload.allowSelfSignup !== undefined,
    {
      message: 'Inga ändringar angavs.'
    }
  )

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const orgParam = parseOrgParam(event)
  const payload = updateSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'
  const organization = await requireOrganizationByIdentifier(db, orgParam)

  const orgUpdates: Partial<typeof organizations.$inferInsert> = {}
  if (payload.name !== undefined) orgUpdates.name = payload.name
  if (payload.slug !== undefined) orgUpdates.slug = payload.slug
  if (payload.billingEmail !== undefined) {
    orgUpdates.billingEmail = payload.billingEmail === '' ? null : payload.billingEmail
  }
  if (payload.defaultRole !== undefined) orgUpdates.defaultRole = payload.defaultRole
  if (payload.requireSso !== undefined) orgUpdates.requireSso = payload.requireSso
  if (payload.allowSelfSignup !== undefined) orgUpdates.allowSelfSignup = payload.allowSelfSignup

  const authUpdates: Partial<typeof organizationAuthSettings.$inferInsert> = {}
  if (payload.requireSso !== undefined) {
    await ensureOrganizationAuthSettings(db, organization.id)
    authUpdates.ssoEnforced = payload.requireSso
  }

  try {
    if (isSqlite) {
      db.transaction((tx) => {
        if (Object.keys(orgUpdates).length) {
          tx.update(organizations).set(orgUpdates).where(eq(organizations.id, organization.id)).run()
        }
        if (Object.keys(authUpdates).length) {
          tx
            .update(organizationAuthSettings)
            .set(authUpdates)
            .where(eq(organizationAuthSettings.organizationId, organization.id))
            .run()
        }
      })
    } else {
      await db.transaction(async (tx) => {
        if (Object.keys(orgUpdates).length) {
          await tx.update(organizations).set(orgUpdates).where(eq(organizations.id, organization.id))
        }
        if (Object.keys(authUpdates).length) {
          await tx
            .update(organizationAuthSettings)
            .set(authUpdates)
            .where(eq(organizationAuthSettings.organizationId, organization.id))
        }
      })
    }
  } catch (error: any) {
    if (
      typeof error?.message === 'string' &&
      (error.message.includes('organizations_slug_idx') ||
        error.message.includes('UNIQUE constraint failed: organizations.slug'))
    ) {
      throw createError({ statusCode: 409, message: 'Sluggen används redan av en annan organisation.' })
    }
    throw error
  }

  return buildOrganizationDetailPayload(db, organization.id)
})

