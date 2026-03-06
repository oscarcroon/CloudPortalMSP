import { createId } from '@paralleldrive/cuid2'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { tenants, tenantMemberships, users, tenantInvitations, distributorProviders } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { normalizeEmail, createInviteToken } from '../../../../utils/crypto'
import { slugify } from '../../../../utils/auth'
import { requireTenantPermission } from '../../../../utils/rbac'
import { ensureAuthState } from '../../../../utils/session'
import { sendDistributorInvitationEmail, sendDistributorConfirmationEmail } from '../../../../utils/mailer'
import type { TenantRole } from '~/constants/rbac'

const createProviderSchema = z.object({
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
  }),
  organization: z
    .object({
      name: z.string().min(2).max(120),
      slug: z
        .string()
        .min(2)
        .max(120)
        .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens.')
        .optional(),
      billingEmail: z.string().email().optional(),
      coreId: z
        .string()
        .trim()
        .min(4)
        .max(20)
        .optional()
    })
    .optional()
})

export default defineEventHandler(async (event) => {
  const distributorId = getRouterParam(event, 'id')
  if (!distributorId) {
    throw createError({ statusCode: 400, message: 'Missing distributor ID' })
  }

  const payload = createProviderSchema.parse(await readBody(event))
  const db = getDb()

  // Validate distributor
  const [distributorTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, distributorId))

  if (!distributorTenant) {
    throw createError({ statusCode: 404, message: 'Distributor not found' })
  }

  if (distributorTenant.type !== 'distributor') {
    throw createError({
      statusCode: 400,
      message: 'Providers can only be created under distributors'
    })
  }

  // Check permission - only super admins or distributor admins with includeChildren can create providers
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  if (!auth.user.isSuperAdmin) {
    const userRole = auth.tenantRoles[distributorId]
    const includeChildren = auth.tenantIncludeChildren?.[distributorId] ?? false
    
    if (!userRole || userRole !== 'admin' || !includeChildren) {
      throw createError({
        statusCode: 403,
        message: 'Super admin or distributor admin with includeChildren required to create providers'
      })
    }
  }

  const normalizedOwnerEmail = normalizeEmail(payload.owner.email)
  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedOwnerEmail))

  const providerId = createId()
  const ownerUserId = existingUser?.id ?? createId()

  try {
    await db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id: providerId,
        name: payload.name,
        slug: payload.slug ?? slugify(payload.name),
        type: 'provider',
        parentTenantId: null,
        status: 'active'
      })

      await tx.insert(distributorProviders).values({
        id: createId(),
        distributorId,
        providerId
      })

      if (!existingUser) {
        await tx.insert(users).values({
          id: ownerUserId,
          email: normalizedOwnerEmail,
          passwordHash: null,
          fullName: payload.owner.fullName?.trim() || normalizedOwnerEmail,
          status: 'active',
          forcePasswordReset: true
        })
      }

      await tx.insert(tenantMemberships).values({
        id: createId(),
        tenantId: providerId,
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
      throw createError({ statusCode: 409, message: 'Provider slug already exists' })
    }
    throw error
  }

  const [provider] = await db.select().from(tenants).where(eq(tenants.id, providerId))

  if (!provider) {
    throw createError({ statusCode: 500, message: 'Provider could not be created correctly' })
  }

  // Send email to owner
  try {
    if (!existingUser) {
      const inviteToken = createInviteToken()
      const inviteExpiresAtMs = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      const inviteExpiresAt = new Date(inviteExpiresAtMs)

      const shouldAttachOrganization = Boolean(payload.organization && payload.organization.name)
      const organizationData =
        shouldAttachOrganization
          ? {
              name: payload.organization!.name.trim(),
              slug: payload.organization!.slug?.trim() || undefined,
              billingEmail: payload.organization!.billingEmail?.trim() || undefined,
              coreId: payload.organization!.coreId?.trim().toUpperCase() || undefined
            }
          : null

      const invitedByLabel = auth.user.email ?? auth.user.fullName ?? 'System'

      const invitationValues: typeof tenantInvitations.$inferInsert = {
        id: createId(),
        tenantId: provider.id,
        email: normalizedOwnerEmail,
      role: 'admin',
        includeChildren: true,
        token: inviteToken,
        status: 'pending',
        invitedByUserId: auth.user.id,
        expiresAt: inviteExpiresAt,
        organizationData: organizationData ? JSON.stringify(organizationData) : null
      }

      await db.insert(tenantInvitations).values(invitationValues)

      await sendDistributorInvitationEmail({
        tenantId: provider.id,
        tenantName: provider.name,
        tenantType: 'provider',
        to: normalizedOwnerEmail,
        expiresAt: inviteExpiresAtMs,
        token: inviteToken,
        invitedBy: invitedByLabel,
        willCreateOrganization: Boolean(organizationData),
        organizationName: organizationData?.name
      })
    } else {
      // Existing user - send confirmation email
      await sendDistributorConfirmationEmail({
        tenantId: provider.id,
        tenantName: provider.name,
        tenantType: 'provider',
        to: normalizedOwnerEmail,
        invitedBy: auth.user.email ?? 'System'
      })
    }
  } catch (error) {
    console.error('[create-provider] Failed to send email to owner', error)
    // Don't fail the request if email fails, but log it
  }

  return {
    tenant: provider,
    owner: {
      id: ownerUserId,
      email: normalizedOwnerEmail,
      fullName: payload.owner.fullName?.trim() || existingUser?.fullName || normalizedOwnerEmail
    }
  }
})

