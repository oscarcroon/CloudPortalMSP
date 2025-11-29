import { createId } from '@paralleldrive/cuid2'
import { and, eq, gte, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import {
  organizationInvitations,
  organizationMemberships,
  organizations,
  organizationAuthSettings,
  tenantMemberships,
  tenants,
  users
} from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { normalizeEmail, createInviteToken } from '../../../../../utils/crypto'
import { requireTenantPermission, requireSuperAdmin } from '../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../utils/session'
import { sendDistributorInvitationEmail, sendDistributorConfirmationEmail } from '../../../../../utils/mailer'
import type { TenantRole } from '~/constants/rbac'

const inviteSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
  role: z.enum(['admin', 'user', 'viewer', 'support']).default('viewer'),
  includeChildren: z.boolean().optional().default(false)
})

const INVITE_VALIDITY_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

// Security limits
const MAX_INVITES_PER_HOUR = 10 // Max invitations per user per hour
const MAX_INVITES_PER_DAY = 50 // Max invitations per user per day
const MAX_MEMBERS_PER_TENANT = 100 // Max active members per tenant
const RATE_LIMIT_WINDOW_HOUR = 1000 * 60 * 60 // 1 hour
const RATE_LIMIT_WINDOW_DAY = 1000 * 60 * 60 * 24 // 1 day

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }

  const payload = inviteSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  // Get tenant first to check type
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  // Only allow invitations for distributors and providers
  if (tenant.type !== 'distributor' && tenant.type !== 'provider') {
    throw createError({
      statusCode: 400,
      message: 'Endast distributörer och leverantörer kan ha medlemmar.'
    })
  }

  // SECURITY: Require superadmin approval for distributor invitations
  if (tenant.type === 'distributor') {
    try {
      await requireSuperAdmin(event)
    } catch (error) {
      throw createError({
        statusCode: 403,
        message: 'Endast superadmins kan bjuda in medlemmar till distributörer.'
      })
    }
  }

  // Check permissions - user must have admin role on the tenant (for providers) or be superadmin (for distributors)
  const permissionCheck = await requireTenantPermission(event, 'tenants:manage-members', tenantId)
  const auth = permissionCheck.auth
  const isSuperAdmin = auth.user.isSuperAdmin

  const normalizedEmail = normalizeEmail(payload.email)
  const targetRole: TenantRole = payload.role

  // SECURITY: Restrict roles for distributors (only superadmins can assign admin or includeChildren)
  if (tenant.type === 'distributor') {
    if (targetRole === 'admin' && !isSuperAdmin) {
      throw createError({
        statusCode: 403,
        message: 'Endast superadmins kan bjuda in admin-roller till distributörer.'
      })
    }
    if (payload.includeChildren && !isSuperAdmin) {
      throw createError({
        statusCode: 403,
        message: 'Endast superadmins kan ge rättigheter för underordnade till distributör-medlemmar.'
      })
    }
  }

  // SECURITY: Rate limiting - check invitations sent by this user in the last hour
  const oneHourAgo = Date.now() - RATE_LIMIT_WINDOW_HOUR
  const oneDayAgo = Date.now() - RATE_LIMIT_WINDOW_DAY

  // Count invitations created by this user in the last hour
  const recentInvitesHour = isSqlite
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.invitedByUserId, auth.user.id),
            gte(organizationInvitations.createdAt, new Date(oneHourAgo))
          )
        )
        .then((rows) => (rows[0]?.count as number) ?? 0)
    : await db
        .select({ count: sql<number>`count(*)` })
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.invitedByUserId, auth.user.id),
            gte(organizationInvitations.createdAt, new Date(oneHourAgo))
          )
        )
        .then((rows) => Number(rows[0]?.count ?? 0))

  if (recentInvitesHour >= MAX_INVITES_PER_HOUR) {
    throw createError({
      statusCode: 429,
      message: `För många inbjudningar. Max ${MAX_INVITES_PER_HOUR} per timme. Försök igen senare.`
    })
  }

  // Count invitations created by this user in the last day
  const recentInvitesDay = isSqlite
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.invitedByUserId, auth.user.id),
            gte(organizationInvitations.createdAt, new Date(oneDayAgo))
          )
        )
        .then((rows) => (rows[0]?.count as number) ?? 0)
    : await db
        .select({ count: sql<number>`count(*)` })
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.invitedByUserId, auth.user.id),
            gte(organizationInvitations.createdAt, new Date(oneDayAgo))
          )
        )
        .then((rows) => Number(rows[0]?.count ?? 0))

  if (recentInvitesDay >= MAX_INVITES_PER_DAY) {
    throw createError({
      statusCode: 429,
      message: `För många inbjudningar. Max ${MAX_INVITES_PER_DAY} per dag. Försök igen senare.`
    })
  }

  // SECURITY: Check max members per tenant
  const activeMembersCount = isSqlite
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.status, 'active')
          )
        )
        .then((rows) => (rows[0]?.count as number) ?? 0)
    : await db
        .select({ count: sql<number>`count(*)` })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.status, 'active')
          )
        )
        .then((rows) => Number(rows[0]?.count ?? 0))

  if (activeMembersCount >= MAX_MEMBERS_PER_TENANT) {
    throw createError({
      statusCode: 400,
      message: `Max antal medlemmar (${MAX_MEMBERS_PER_TENANT}) har nåtts för denna tenant.`
    })
  }

  // Check if user already exists
  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)

  // SECURITY: Check for existing pending invitation for this email to this tenant
  // We need to check all temp orgs for this tenant (organizations with name ending in " - System")
  const rows = isSqlite
    ? await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.tenantId, tenantId))
        .all()
    : await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.tenantId, tenantId))
  const tempOrgs = rows.filter((r) => r.id && r.id.includes('-system')).map((r) => r.id)

  if (tempOrgs.length > 0) {
    // Check for pending invitations in any of these temp orgs
    for (const orgId of tempOrgs) {
      const existingPendingInvite = isSqlite
        ? await db
            .select()
            .from(organizationInvitations)
            .where(
              and(
                eq(organizationInvitations.organizationId, orgId),
                eq(organizationInvitations.email, normalizedEmail),
                eq(organizationInvitations.status, 'pending')
              )
            )
            .get()
        : await db
            .select()
            .from(organizationInvitations)
            .where(
              and(
                eq(organizationInvitations.organizationId, orgId),
                eq(organizationInvitations.email, normalizedEmail),
                eq(organizationInvitations.status, 'pending')
              )
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)

      if (existingPendingInvite) {
        throw createError({
          statusCode: 409,
          message: 'Det finns redan en väntande inbjudan för denna e-postadress till denna tenant.'
        })
      }
    }
  }

  // Check if user is already a member
  if (existingUser) {
    const [existingMembership] = await db
      .select()
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, existingUser.id)))
      .limit(1)

    if (existingMembership && existingMembership.status === 'active') {
      throw createError({
        statusCode: 409,
        message: 'Användaren är redan medlem i denna tenant.'
      })
    }
  }

  // Create temporary organization for invitation (same approach as when creating tenants)
  const tempOrgId = createId()
  const inviteToken = createInviteToken()
  const inviteExpiresAtMs = Date.now() + INVITE_VALIDITY_MS
  const inviteExpiresAt = new Date(inviteExpiresAtMs)

  try {
    if (isSqlite) {
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
            requireSso: false,
            allowSelfSignup: false
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
            email: normalizedEmail,
            role: 'owner', // Always owner for temp org
            token: inviteToken,
            status: 'pending',
            invitedByUserId: auth.user.id,
            expiresAt: inviteExpiresAt
          })
          .run()

        // If user exists and has active membership, update it
        if (existingUser) {
          const existingMemberships = tx
            .select()
            .from(tenantMemberships)
            .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, existingUser.id)))
            .all()

          if (existingMemberships && existingMemberships.length > 0) {
            tx.update(tenantMemberships)
              .set({
                role: targetRole,
                includeChildren: payload.includeChildren ? 1 : 0,
                status: 'active',
                updatedAt: new Date()
              })
              .where(eq(tenantMemberships.id, existingMemberships[0].id))
              .run()
          } else {
            // Create membership directly for existing user
            tx.insert(tenantMemberships)
              .values({
                id: createId(),
                tenantId,
                userId: existingUser.id,
                role: targetRole,
                includeChildren: payload.includeChildren ? 1 : 0,
                status: 'active'
              })
              .run()
          }
        }
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
          email: normalizedEmail,
          role: 'owner', // Always owner for temp org
          token: inviteToken,
          status: 'pending',
          invitedByUserId: auth.user.id,
          expiresAt: inviteExpiresAt
        })

        // If user exists and has active membership, update it
        if (existingUser) {
          const existingMembership = await tx
            .select()
            .from(tenantMemberships)
            .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, existingUser.id)))
            .limit(1)

          if (existingMembership && existingMembership.length > 0) {
            await tx
              .update(tenantMemberships)
              .set({
                role: targetRole,
                includeChildren: payload.includeChildren ? 1 : 0,
                status: 'active',
                updatedAt: new Date()
              })
              .where(eq(tenantMemberships.id, existingMembership[0].id))
          } else {
            // Create membership directly for existing user
            await tx.insert(tenantMemberships).values({
              id: createId(),
              tenantId,
              userId: existingUser.id,
              role: targetRole,
              includeChildren: payload.includeChildren ? 1 : 0,
              status: 'active'
            })
          }
        }
      })
    }

    // Send invitation email
    if (!existingUser) {
      // New user - send invitation email
      await sendDistributorInvitationEmail({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantType: tenant.type,
        to: normalizedEmail,
        expiresAt: inviteExpiresAtMs,
        token: inviteToken,
        invitedBy: auth.user.email ?? 'System'
      })
    } else {
      // Existing user - check if they got membership
      const [membership] = await db
        .select()
        .from(tenantMemberships)
        .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, existingUser.id)))
        .limit(1)

      if (membership && membership.status === 'active') {
        // User was added directly - send confirmation email
        await sendDistributorConfirmationEmail({
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantType: tenant.type,
          to: normalizedEmail,
          invitedBy: auth.user.email ?? 'System'
        })
      } else {
        // User needs to accept invitation
        await sendDistributorInvitationEmail({
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantType: tenant.type,
          to: normalizedEmail,
          expiresAt: inviteExpiresAtMs,
          token: inviteToken,
          invitedBy: auth.user.email ?? 'System'
        })
      }
    }

    // SECURITY: Log invitation for audit trail
    console.info(
      `[tenant-invite] User ${auth.user.email} (${auth.user.id}) invited ${normalizedEmail} to tenant ${tenant.name} (${tenantId}) with role ${targetRole}, includeChildren: ${payload.includeChildren}`
    )

    return {
      success: true,
      message: existingUser ? 'Medlem tillagd.' : 'Inbjudan skickad.'
    }
  } catch (error: any) {
    // SECURITY: Log failed invitation attempts
    console.warn(
      `[tenant-invite] Failed invitation attempt by ${auth.user.email} (${auth.user.id}) for ${normalizedEmail} to tenant ${tenantId}: ${error.message}`
    )

    if (
      typeof error?.message === 'string' &&
      (error.message.includes('organization_invites_token_idx') ||
        error.message.includes('UNIQUE constraint failed'))
    ) {
      throw createError({ statusCode: 409, message: 'En inbjudan för denna e-postadress finns redan.' })
    }
    throw error
  }
})

