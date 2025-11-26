import { createError, defineEventHandler, readBody, getRequestHeaders } from 'h3'
import { getClientIP } from '../../utils/ip'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { requireSession } from '../../utils/session'
import { getDb } from '../../utils/db'
import {
  organizationAuthSettings,
  organizationMemberships,
  organizations,
  tenantAuthSettings,
  tenantMemberships,
  tenants,
  auditLogs
} from '../../database/schema'
import { createId } from '@paralleldrive/cuid2'
import { requireMfa } from '../../utils/mfa'
import { rateLimiters } from '../../utils/rateLimit'
import { logContextSwitch } from '../../utils/audit'
import { canAccessOrganization } from '../../utils/rbac'

const schema = z.object({
  organizationId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional()
})

export default defineEventHandler(async (event) => {
  // Apply rate limiting
  await rateLimiters.contextSwitch(event)

  const body = schema.parse(await readBody(event))
  const auth = await requireSession(event)
  const db = getDb()

  const fromContext = {
    organizationId: auth.currentOrgId,
    tenantId: auth.currentTenantId
  }

  let newOrgId = auth.currentOrgId
  let newTenantId = auth.currentTenantId

  // Validate and set organization if provided
  if (body.organizationId !== undefined) {
    if (body.organizationId) {
      // Verify user can access this organization (direct membership OR via tenant hierarchy)
      const canAccess = await canAccessOrganization(auth, body.organizationId)
      if (!canAccess) {
        throw createError({ statusCode: 403, message: 'Du har inte åtkomst till denna organisation.' })
      }

      // Get membership for role/SSO checks (if direct membership exists)
      const [membership] = await db
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.userId, auth.user.id),
            eq(organizationMemberships.organizationId, body.organizationId),
            eq(organizationMemberships.status, 'active')
          )
        )
        .limit(1)

      const [target] = await db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          requireSso: organizations.requireSso,
          allowLocalLoginForOwners: organizationAuthSettings.allowLocalLoginForOwners,
          requireMfaOnContextSwitch: organizationAuthSettings.requireMfaOnContextSwitch
        })
        .from(organizations)
        .leftJoin(
          organizationAuthSettings,
          eq(organizationAuthSettings.organizationId, organizations.id)
        )
        .where(eq(organizations.id, body.organizationId))

      if (!target) {
        throw createError({ statusCode: 404, message: 'Organisationen kunde inte hittas.' })
      }

      const requiresSso = Boolean(target.requireSso)
      // If user has direct membership, check owner override. Otherwise, SSO is required if enforced.
      const ownerOverride =
        membership && membership.role === 'owner' && Boolean(target.allowLocalLoginForOwners)

      if (requiresSso && !auth.user.isSuperAdmin && !ownerOverride) {
        throw createError({
          statusCode: 409,
          message: 'Organisationen kräver SSO. Starta SSO-inloggningen för att få åtkomst.',
          data: {
            requireSso: true,
            slug: target.slug
          }
        })
      }

      // Check if MFA is required for context switch
      if (target.requireMfaOnContextSwitch && !auth.user.isSuperAdmin) {
        const mfaResult = await requireMfa(event, 'org', body.organizationId, 'contextSwitch')
        if (!mfaResult.success && mfaResult.requiresMfa) {
          throw createError({
            statusCode: 403,
            message: 'MFA krävs för att byta till denna organisation.',
            data: {
              requiresMfa: true,
              scope: 'org',
              scopeId: body.organizationId
            }
          })
        }
      }

      newOrgId = body.organizationId
    } else {
      newOrgId = null
    }
  }

  // Validate and set tenant if provided
  if (body.tenantId !== undefined) {
    if (body.tenantId) {
      // Verify membership
      const [membership] = await db
        .select()
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.userId, auth.user.id),
            eq(tenantMemberships.tenantId, body.tenantId),
            eq(tenantMemberships.status, 'active')
          )
        )
        .limit(1)

      if (!membership) {
        throw createError({ statusCode: 403, message: 'Du har inte åtkomst till denna tenant.' })
      }

      const [target] = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          type: tenants.type,
          requireMfaOnContextSwitch: tenantAuthSettings.requireMfaOnContextSwitch
        })
        .from(tenants)
        .leftJoin(tenantAuthSettings, eq(tenantAuthSettings.tenantId, tenants.id))
        .where(eq(tenants.id, body.tenantId))

      if (!target) {
        throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
      }

      // Check if MFA is required for context switch
      if (target.requireMfaOnContextSwitch && !auth.user.isSuperAdmin) {
        const mfaResult = await requireMfa(event, 'tenant', body.tenantId, 'contextSwitch')
        if (!mfaResult.success && mfaResult.requiresMfa) {
          throw createError({
            statusCode: 403,
            message: 'MFA krävs för att byta till denna tenant.',
            data: {
              requiresMfa: true,
              scope: 'tenant',
              scopeId: body.tenantId
            }
          })
        }
      }

      newTenantId = body.tenantId
    } else {
      newTenantId = null
    }
  }

  // Update session
  const { refreshSession } = await import('../../utils/session')
  const updated = await refreshSession(event, newOrgId, newTenantId)

  // Log context switch using audit utility
  await logContextSwitch(
    event,
    fromContext,
    {
      organizationId: newOrgId,
      tenantId: newTenantId
    },
    false // MFA status would be determined earlier if needed
  )

  return updated
})

