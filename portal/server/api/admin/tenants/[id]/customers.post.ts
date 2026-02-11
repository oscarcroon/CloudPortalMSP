import { createId } from '@paralleldrive/cuid2'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  tenants,
  organizations,
  organizationMemberships,
  organizationAuthSettings,
  users
} from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { normalizeEmail } from '../../../../utils/crypto'
import { slugify } from '../../../../utils/auth'
import { requireTenantPermission } from '../../../../utils/rbac'
import { rbacRoles } from '~/constants/rbac'
import { initializeNewOrganization } from '../../../../utils/orgSetup'

const createCustomerSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens.')
    .optional(),
  billingEmail: z.string().email().optional(),
  coreId: z.string().length(4, 'COREID must be exactly 4 characters').optional(),
  defaultRole: z.enum(rbacRoles).optional(),
  owner: z.object({
    email: z.string().email(),
    fullName: z.string().min(2).max(120).optional()
  })
})

export default defineEventHandler(async (event) => {
  const distributorTenantId = getRouterParam(event, 'id')
  if (!distributorTenantId) {
    throw createError({ statusCode: 400, message: 'Missing distributor tenant ID' })
  }

  await requireTenantPermission(event, 'tenants:create-customer', distributorTenantId)

  const payload = createCustomerSchema.parse(await readBody(event))
  const db = getDb()

  // Verify parent is a distributor
  const [distributorTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, distributorTenantId))

  if (!distributorTenant) {
    throw createError({ statusCode: 404, message: 'Distributor tenant not found' })
  }

  if (distributorTenant.type !== 'distributor') {
    throw createError({
      statusCode: 400,
      message: 'Organizations can only be created under distributors'
    })
  }

  const normalizedOwnerEmail = normalizeEmail(payload.owner.email)
  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedOwnerEmail))

  const organizationId = createId()
  const ownerUserId = existingUser?.id ?? createId()
  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      await tx.insert(organizations).values({
        id: organizationId,
        name: payload.name,
        slug: payload.slug ?? slugify(payload.name),
        tenantId: distributorTenantId,
        status: 'active',
        billingEmail: payload.billingEmail,
        requireSso: false,
        allowSelfSignup: false,
        defaultRole: payload.defaultRole ?? 'viewer',
        coreId: payload.coreId ? payload.coreId.toUpperCase() : null
      })

      await tx.insert(organizationAuthSettings).values({
        organizationId,
        idpType: 'none',
        ssoEnforced: false,
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
          forcePasswordReset: true
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

      await tx.insert(organizationMemberships).values({
        id: createId(),
        organizationId,
        userId: ownerUserId,
        role: 'owner',
        status: 'active'
      })
    })
  } catch (error: any) {
    if (
      typeof error?.message === 'string' &&
      (error.message.includes('organizations_slug_idx') ||
        error.message.includes('UNIQUE constraint failed: organizations.slug'))
    ) {
      throw createError({ statusCode: 409, message: 'Organization slug already exists' })
    }
    throw error
  }

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))

  // Initialize organization with blocked modules and default groups
  try {
    const setupResult = await initializeNewOrganization({
      orgId: organizationId,
      ownerUserId,
      tenantId: distributorTenantId
    })
    console.log(`[customers.post] Initialized org ${organizationId}: ${setupResult.modulesBlocked} modules blocked`)
  } catch (initError) {
    console.error('[customers.post] Failed to initialize organization setup', initError)
    // Don't fail - org is created, setup can be retried
  }

  return {
    organization,
    owner: {
      id: ownerUserId,
      email: normalizedOwnerEmail,
      fullName: payload.owner.fullName ?? existingUser?.fullName ?? null
    }
  }
})

