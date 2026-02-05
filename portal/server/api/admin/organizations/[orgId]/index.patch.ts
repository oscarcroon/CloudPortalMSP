import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { rbacRoles } from '~/constants/rbac'
import {
  organizationAuthSettings,
  organizations
} from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { canAccessOrganization, requireTenantPermission } from '../../../../utils/rbac'
import { ensureAuthState } from '../../../../utils/session'
import {
  buildOrganizationDetailPayload,
  ensureOrganizationAuthSettings,
  parseOrgParam,
  requireOrganizationByIdentifier,
  slugRegex
} from '../utils'
import { logOrganizationAction } from '../../../../utils/audit'

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
    coreId: z.union([z.string().max(4), z.literal(null), z.literal('')]).optional(),
    defaultRole: z.enum(rbacRoles).optional(),
    requireSso: z.boolean().optional()
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.slug !== undefined ||
      payload.billingEmail !== undefined ||
      payload.coreId !== undefined ||
      payload.defaultRole !== undefined ||
      payload.requireSso !== undefined,
    {
      message: 'Inga ändringar angavs.'
    }
  )

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const payload = updateSchema.parse(await readBody(event))
  const db = getDb()
  const auth = await ensureAuthState(event)
  
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const organization = await requireOrganizationByIdentifier(db, orgParam)

  // Super admins can always update
  if (!auth.user.isSuperAdmin) {
    // Check if user has access to the organization
    const hasAccess = await canAccessOrganization(auth, organization.id)
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: 'Du har inte behörighet att uppdatera denna organisation.'
      })
    }

    // If organization belongs to a provider tenant, user must have manage permission for that tenant
    if (organization.tenantId) {
      try {
        await requireTenantPermission(event, 'tenants:manage', organization.tenantId)
      } catch {
        throw createError({
          statusCode: 403,
          message: 'Du måste vara admin för leverantören som organisationen tillhör för att uppdatera den.'
        })
      }
    } else {
      // Organization without tenant - only super admins can update
      throw createError({
        statusCode: 403,
        message: 'Endast superadmins kan uppdatera organisationer utan leverantör.'
      })
    }
  }

  // Store old values for audit log
  const oldValues = {
    name: organization.name,
    slug: organization.slug,
    billingEmail: organization.billingEmail,
    coreId: organization.coreId,
    defaultRole: organization.defaultRole,
    requireSso: organization.requireSso
  }

  const orgUpdates: Partial<typeof organizations.$inferInsert> = {}
  if (payload.name !== undefined) orgUpdates.name = payload.name
  if (payload.slug !== undefined) orgUpdates.slug = payload.slug
  if (payload.billingEmail !== undefined) {
    orgUpdates.billingEmail = payload.billingEmail === '' ? null : payload.billingEmail
  }
  if (payload.coreId !== undefined) {
    orgUpdates.coreId = payload.coreId === '' ? null : payload.coreId?.toUpperCase() ?? null
  }
  if (payload.defaultRole !== undefined) orgUpdates.defaultRole = payload.defaultRole
  if (payload.requireSso !== undefined) orgUpdates.requireSso = payload.requireSso

  const authUpdates: Partial<typeof organizationAuthSettings.$inferInsert> = {}
  if (payload.requireSso !== undefined) {
    await ensureOrganizationAuthSettings(db, organization.id)
    authUpdates.ssoEnforced = payload.requireSso
  }

  try {
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

  // Log audit event
  const changedFields: Record<string, { old: any; new: any }> = {}
  if (payload.name !== undefined && payload.name !== oldValues.name) {
    changedFields.name = { old: oldValues.name, new: payload.name }
  }
  if (payload.slug !== undefined && payload.slug !== oldValues.slug) {
    changedFields.slug = { old: oldValues.slug, new: payload.slug }
  }
  if (payload.billingEmail !== undefined && payload.billingEmail !== oldValues.billingEmail) {
    changedFields.billingEmail = { old: oldValues.billingEmail, new: payload.billingEmail }
  }
  if (payload.coreId !== undefined && payload.coreId !== oldValues.coreId) {
    changedFields.coreId = { old: oldValues.coreId, new: payload.coreId }
  }
  if (payload.defaultRole !== undefined && payload.defaultRole !== oldValues.defaultRole) {
    changedFields.defaultRole = { old: oldValues.defaultRole, new: payload.defaultRole }
  }
  if (payload.requireSso !== undefined && payload.requireSso !== oldValues.requireSso) {
    changedFields.requireSso = { old: oldValues.requireSso, new: payload.requireSso }
  }

  if (Object.keys(changedFields).length > 0) {
    await logOrganizationAction(event, 'ORGANIZATION_UPDATED', {
      changedFields
    }, organization.id)
  }

  return buildOrganizationDetailPayload(db, organization.id)
})

