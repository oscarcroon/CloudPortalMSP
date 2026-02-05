import { createId } from '@paralleldrive/cuid2'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { tenants, tenantMemberships, users, tenantInvitations } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { normalizeEmail, createInviteToken } from '../../../../utils/crypto'
import { slugify } from '../../../../utils/auth'
import { requireSuperAdmin } from '../../../../utils/rbac'
import { sendDistributorInvitationEmail, sendDistributorConfirmationEmail } from '../../../../utils/mailer'
import type { TenantRole } from '~/constants/rbac'

const createDistributorSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens.')
    .optional(),
  owner: z.object({
    email: z.string().email(),
    fullName: z.string().min(2).max(120).optional()
  })
})

export default defineEventHandler(async (event) => {
  const parentTenantId = getRouterParam(event, 'id')
  if (!parentTenantId) {
    throw createError({ statusCode: 400, message: 'Missing parent tenant ID' })
  }

  // Only super admins can create distributors
  await requireSuperAdmin(event)

  const payload = createDistributorSchema.parse(await readBody(event))
  const db = getDb()

  // Note: This endpoint seems to be legacy - distributors should not be created under providers
  // Keeping for backward compatibility but requiring super admin
  const [parentTenant] = await db.select().from(tenants).where(eq(tenants.id, parentTenantId))

  if (!parentTenant) {
    throw createError({ statusCode: 404, message: 'Parent tenant not found' })
  }

  const normalizedOwnerEmail = normalizeEmail(payload.owner.email)
  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedOwnerEmail))

  const tenantId = createId()
  const ownerUserId = existingUser?.id ?? createId()
  const now = new Date()
  try {
    await db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id: tenantId,
        name: payload.name,
        slug: payload.slug ?? slugify(payload.name),
        type: 'distributor',
        parentTenantId,
        status: 'active'
      })

      if (!existingUser) {
        await tx.insert(users).values({
          id: ownerUserId,
          email: normalizedOwnerEmail,
          passwordHash: null,
          fullName: payload.owner.fullName,
          status: 'active',
          forcePasswordReset: true
        })
      }

      await tx.insert(tenantMemberships).values({
        id: createId(),
        tenantId,
        userId: ownerUserId,
        role: 'admin',
        includeChildren: true,
        status: 'active'
      })
    })
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
  throw createError({ statusCode: 404, message: 'Tenant not found' })
}

  // Send email to owner
  try {
    if (!existingUser) {
      const inviteToken = createInviteToken()
      const inviteExpiresAtMs = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      const inviteExpiresAt = new Date(inviteExpiresAtMs)
      
      const invitationValues: typeof tenantInvitations.$inferInsert = {
        id: createId(),
        tenantId: tenant.id,
        email: normalizedOwnerEmail,
        role: 'admin',
        includeChildren: true,
        token: inviteToken,
        status: 'pending',
        invitedByUserId: null,
        expiresAt: inviteExpiresAt,
        organizationData: null
      }

      await db.insert(tenantInvitations).values(invitationValues)
      
      await sendDistributorInvitationEmail({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantType: 'distributor',
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
        tenantType: 'distributor',
        to: normalizedOwnerEmail,
        invitedBy: 'System'
      })
    }
  } catch (error) {
    console.error('[create-distributor] Failed to send email to owner', error)
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

