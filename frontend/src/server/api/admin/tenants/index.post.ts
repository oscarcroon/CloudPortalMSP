import { createId } from '@paralleldrive/cuid2'
import { createError, defineEventHandler, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { tenants, tenantMemberships, users, organizations, organizationInvitations, organizationAuthSettings } from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { normalizeEmail, createInviteToken } from '../../../utils/crypto'
import { slugify } from '../../../utils/auth'
import { requireTenantPermission } from '../../../utils/rbac'
import { ensureAuthState } from '../../../utils/session'
import { sendDistributorInvitationEmail, sendDistributorConfirmationEmail } from '../../../utils/mailer'
import type { TenantRole } from '~/constants/rbac'

const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens.')
    .optional(),
  type: z.enum(['provider', 'distributor']),
  parentTenantId: z.string().optional(),
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

  // Validate parent tenant if provided
  if (payload.parentTenantId) {
    const [parentTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, payload.parentTenantId))

    if (!parentTenant) {
      throw createError({ statusCode: 404, message: 'Parent tenant not found' })
    }

    if (parentTenant.type !== 'provider' && payload.type === 'distributor') {
      throw createError({
        statusCode: 400,
        message: 'Distributors can only be created under providers'
      })
    }

    // Check permission to create tenant under parent
    const permission =
      payload.type === 'distributor' ? 'tenants:create-distributor' : 'tenants:create-customer'
    await requireTenantPermission(event, permission, payload.parentTenantId)
  } else {
    // Creating a provider requires super admin or admin role with includeChildren
    if (payload.type === 'provider') {
      const auth = await ensureAuthState(event)
      if (!auth?.user.isSuperAdmin) {
        // Check if user has admin role with includeChildren in any tenant
        let hasPermission = false
        for (const [tenantId, role] of Object.entries(auth?.tenantRoles ?? {})) {
          const includeChildren = auth?.tenantIncludeChildren?.[tenantId] ?? false
          if (role === 'admin' && includeChildren) {
            hasPermission = true
            break
          }
        }
        if (!hasPermission) {
          throw createError({
            statusCode: 403,
            message: 'Super admin or admin with includeChildren required to create providers'
          })
        }
      }
    } else {
      throw createError({
        statusCode: 400,
        message: 'Distributors must have a parent supplier'
      })
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
        const tenantValues = {
          id: tenantId,
          name: payload.name,
          slug: payload.slug ?? slugify(payload.name),
          type: payload.type,
          parentTenantId: payload.parentTenantId ?? null,
          status: 'active'
        }

        tx.insert(tenants).values(tenantValues).run()

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
        const tenantValues = {
          id: tenantId,
          name: payload.name,
          slug: payload.slug ?? slugify(payload.name),
          type: payload.type,
          parentTenantId: payload.parentTenantId ?? null,
          status: 'active'
        }

        await tx.insert(tenants).values(tenantValues)

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

  // Send email to owner
  try {
    if (!existingUser) {
      // New user - create a temporary organization for invitation and send invitation email
      const tempOrgId = createId()
      const inviteToken = createInviteToken()
      const inviteExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      const inviteExpiresAtDate = new Date(inviteExpiresAt)
      
      const isSqliteForInvite =
        (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'
      
      if (isSqliteForInvite) {
        await db.transaction((tx) => {
          // Create temporary organization for invitation
          tx.insert(organizations)
            .values({
              id: tempOrgId,
              name: `${tenant.name} - System`,
              slug: `${tenant.slug}-system`,
              tenantId: tenant.id,
              status: 'active',
              defaultRole: 'owner',
              requireSso: 0,
              allowSelfSignup: 0
            })
            .run()
          
          tx.insert(organizationAuthSettings)
            .values({
              organizationId: tempOrgId,
              idpType: 'none',
              ssoEnforced: false,
              allowLocalLoginForOwners: true
            })
            .run()
          
          // Create invitation
          tx.insert(organizationInvitations)
            .values({
              id: createId(),
              organizationId: tempOrgId,
              email: normalizedOwnerEmail,
              role: 'owner',
              token: inviteToken,
              status: 'pending',
              invitedByUserId: null,
              expiresAt: inviteExpiresAtDate
            })
            .run()
        })
      } else {
        await db.transaction(async (tx) => {
          // Create temporary organization for invitation
          await tx.insert(organizations).values({
            id: tempOrgId,
            name: `${tenant.name} - System`,
            slug: `${tenant.slug}-system`,
            tenantId: tenant.id,
            status: 'active',
            defaultRole: 'owner',
            requireSso: false,
            allowSelfSignup: false
          })
          
          await tx.insert(organizationAuthSettings).values({
            organizationId: tempOrgId,
            idpType: 'none',
            ssoEnforced: false,
            allowLocalLoginForOwners: true
          })
          
          // Create invitation
          await tx.insert(organizationInvitations).values({
            id: createId(),
            organizationId: tempOrgId,
            email: normalizedOwnerEmail,
            role: 'owner',
            token: inviteToken,
            status: 'pending',
            invitedByUserId: null,
            expiresAt: inviteExpiresAtDate
          })
        })
      }
      
      await sendDistributorInvitationEmail({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantType: payload.type,
        to: normalizedOwnerEmail,
        expiresAt: inviteExpiresAt,
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

