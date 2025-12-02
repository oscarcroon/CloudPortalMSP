import { createError, defineEventHandler, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { refreshSession, requireSession } from '../../utils/session'
import { getDb } from '../../utils/db'
import { organizationAuthSettings, organizationMemberships, organizations } from '../../database/schema'
import { canAccessOrganization } from '../../utils/rbac'

const schema = z.object({
  organizationId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { organizationId } = schema.parse(await readBody(event))
  const auth = await requireSession(event)
  const db = getDb()
  
  // Verify user can access this organization (direct membership OR via tenant hierarchy)
  const canAccess = await canAccessOrganization(auth, organizationId)
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
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.status, 'active')
      )
    )
    .limit(1)

  const [target] = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      requireSso: organizations.requireSso,
      allowLocalLoginForOwners: organizationAuthSettings.allowLocalLoginForOwners
    })
    .from(organizations)
    .leftJoin(
      organizationAuthSettings,
      eq(organizationAuthSettings.organizationId, organizations.id)
    )
    .where(eq(organizations.id, organizationId))

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

  // Update lastAccessedAt for this membership if user has direct membership
  if (membership) {
    await db
      .update(organizationMemberships)
      .set({ lastAccessedAt: new Date() })
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, auth.user.id)
        )
      )
  }

  const updated = await refreshSession(event, organizationId)
  return updated
})

