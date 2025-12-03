import { createId } from '@paralleldrive/cuid2'
import { createError, defineEventHandler, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { tenants, tenantMemberships, users, tenantInvitations, distributorProviders } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { normalizeEmail, createInviteToken } from '../../../utils/crypto'
import { slugify } from '../../../utils/auth'
import { requireTenantPermission, requireSuperAdmin } from '../../../utils/rbac'
import { ensureAuthState } from '../../../utils/session'
import { sendDistributorInvitationEmail, sendDistributorConfirmationEmail } from '../../../utils/mailer'
import type { TenantRole } from '~/constants/rbac'
import { logTenantAction } from '../../../utils/audit'

const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens.')
    .optional(),
  type: z.enum(['provider', 'distributor']),
  distributorIds: z.array(z.string()).optional(), // For providers: which distributors to link to
  owner: z.object({
    email: z.string().email(),
    fullName: z.string().min(2).max(120).optional()
  })
})

export default defineEventHandler(async (event) => {
  const payload = createTenantSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  // Validate and check permissions based on type
  if (payload.type === 'distributor') {
    // Distributors are root level - require super admin ONLY
    await requireSuperAdmin(event)
  } else if (payload.type === 'provider') {
    // Providers must be linked to at least one distributor
    if (!payload.distributorIds || payload.distributorIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Providers must be linked to at least one distributor'
      })
    }

    const auth = await ensureAuthState(event)
    if (!auth) {
      throw createError({ statusCode: 401, message: 'Not authenticated' })
    }

    // Only super admins or distributor admins with includeChildren can create providers
    if (!auth.user.isSuperAdmin) {
      let hasPermission = false
      for (const [tenantId, role] of Object.entries(auth.tenantRoles)) {
        const includeChildren = auth.tenantIncludeChildren?.[tenantId] ?? false
        if (role === 'admin' && includeChildren) {
          // Verify this tenant is a distributor
          const [tenant] = await db
            .select()
            .from(tenants)
            .where(eq(tenants.id, tenantId))
          
          if (tenant && tenant.type === 'distributor') {
            hasPermission = true
            break
          }
        }
      }
      if (!hasPermission) {
        throw createError({
          statusCode: 403,
          message: 'Super admin or distributor admin with includeChildren required to create providers'
        })
      }
    }

    // Validate all distributors exist
    for (const distributorId of payload.distributorIds) {
      const [distributor] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, distributorId))

      if (!distributor) {
        throw createError({ statusCode: 404, message: `Distributor ${distributorId} not found` })
      }

      if (distributor.type !== 'distributor') {
        throw createError({
          statusCode: 400,
          message: `Tenant ${distributorId} is not a distributor`
        })
      }

      // For non-super-admins, verify they have access to this distributor
      if (!auth.user.isSuperAdmin) {
        const userRole = auth.tenantRoles[distributorId]
        const includeChildren = auth.tenantIncludeChildren?.[distributorId] ?? false
        if (!userRole || userRole !== 'admin' || !includeChildren) {
          throw createError({
            statusCode: 403,
            message: `Access denied to distributor ${distributorId}`
          })
        }
      }
    }
  }

  const normalizedOwnerEmail = normalizeEmail(payload.owner.email)
  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedOwnerEmail))

  const tenantId = createId()
  const ownerUserId = existingUser?.id ?? createId()
  const now = new Date()

  try {
    if (isSqlite) {
      await db.transaction((tx) => {
        // Distributors are root level (no parentTenantId), Providers are also root level
        const tenantValues = {
          id: tenantId,
          name: payload.name,
          slug: payload.slug ?? slugify(payload.name),
          type: payload.type,
          parentTenantId: null, // Both distributors and providers are root level now
          status: 'active'
        }

        tx.insert(tenants).values(tenantValues).run()

        // For providers, create junction table entries to link to distributors
        if (payload.type === 'provider' && payload.distributorIds) {
          for (const distributorId of payload.distributorIds) {
            tx.insert(distributorProviders)
              .values({
                id: createId(),
                distributorId,
                providerId: tenantId
              })
              .run()
          }
        }

        if (!existingUser) {
          tx.insert(users)
            .values({
              id: ownerUserId,
              email: normalizedOwnerEmail,
              passwordHash: null,
              fullName: payload.owner.fullName,
              status: 'active',
              forcePasswordReset: 1
            })
            .run()
        }

        // For providers and distributors, set admin role with includeChildren=true
        const role: TenantRole = 'admin'
        const includeChildren = payload.type === 'provider' || payload.type === 'distributor'

        tx.insert(tenantMemberships)
          .values({
            id: createId(),
            tenantId,
            userId: ownerUserId,
            role,
            includeChildren,
            status: 'active'
          })
          .run()
      })
    } else {
      await db.transaction(async (tx) => {
        // Distributors are root level (no parentTenantId), Providers are also root level
        const tenantValues = {
          id: tenantId,
          name: payload.name,
          slug: payload.slug ?? slugify(payload.name),
          type: payload.type,
          parentTenantId: null, // Both distributors and providers are root level now
          status: 'active'
        }

        await tx.insert(tenants).values(tenantValues)

        // For providers, create junction table entries to link to distributors
        if (payload.type === 'provider' && payload.distributorIds) {
          for (const distributorId of payload.distributorIds) {
            await tx.insert(distributorProviders).values({
              id: createId(),
              distributorId,
              providerId: tenantId
            })
          }
        }

        if (!existingUser) {
          await tx.insert(users).values({
            id: ownerUserId,
            email: normalizedOwnerEmail,
            passwordHash: null,
            fullName: payload.owner.fullName,
            status: 'active',
            forcePasswordReset: 1
          })
        }

        // For providers and distributors, set admin role with includeChildren=true
        const role: TenantRole = 'admin'

        await tx.insert(tenantMemberships).values({
          id: createId(),
          tenantId,
          userId: ownerUserId,
          role,
          status: 'active'
        })
      })
    }
  } catch (error: any) {
    if (
      typeof error?.message === 'string' &&
      (error.message.includes('tenants_slug_idx') ||
        error.message.includes('UNIQUE constraint failed: tenants.slug'))
    ) {
      throw createError({ statusCode: 409, message: 'Tenant slug already exists' })
    }
    throw error
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))

  if (!tenant) {
    throw createError({ statusCode: 500, message: 'Tenant could not be created correctly' })
  }

  // Log audit event
  await logTenantAction(event, 'TENANT_CREATED', {
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    tenantType: tenant.type,
    ownerEmail: normalizedOwnerEmail,
    distributorIds: payload.distributorIds
  }, tenant.id)

  // Send email to owner
  try {
    if (!existingUser) {
      const inviteToken = createInviteToken()
      const inviteExpiresAtMs = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      const inviteExpiresAt = new Date(inviteExpiresAtMs)
      const isSqliteForInvite =
        (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

      const invitationValues = {
        id: createId(),
        tenantId: tenant.id,
        email: normalizedOwnerEmail,
        role: 'admin' as TenantRole,
        includeChildren: true,
        token: inviteToken,
        status: 'pending',
        invitedByUserId: null,
        expiresAt: inviteExpiresAt,
        organizationData: null
      }

      if (isSqliteForInvite) {
        await db.insert(tenantInvitations).values(invitationValues).run()
      } else {
        await db.insert(tenantInvitations).values(invitationValues)
      }

      await sendDistributorInvitationEmail({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantType: payload.type,
        to: normalizedOwnerEmail,
        expiresAt: inviteExpiresAtMs,
        token: inviteToken,
        invitedBy: 'System'
      })
    } else {
      // Existing user - send confirmation email
      await sendDistributorConfirmationEmail({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantType: payload.type,
        to: normalizedOwnerEmail,
        invitedBy: 'System'
      })
    }
  } catch (error) {
    console.error('[create-tenant] Failed to send email to owner', error)
    // Don't fail the request if email fails, but log it
  }

  return {
    tenant,
    owner: {
      id: ownerUserId,
      email: normalizedOwnerEmail,
      fullName: payload.owner.fullName ?? existingUser?.fullName ?? null
    }
  }
})

