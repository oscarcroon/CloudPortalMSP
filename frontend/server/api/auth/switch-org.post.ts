import { createError, defineEventHandler, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { ensureMembership } from '../../utils/auth'
import { refreshSession, requireSession } from '../../utils/session'
import { getDb } from '../../utils/db'
import { organizationAuthSettings, organizationMemberships, organizations } from '../../database/schema'

const schema = z.object({
  organizationId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { organizationId } = schema.parse(await readBody(event))
  const auth = await requireSession(event)
  const membership = await ensureMembership(auth.user.id, organizationId)

  const db = getDb()
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
  const ownerOverride =
    membership.role === 'owner' && Boolean(target.allowLocalLoginForOwners)

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

  // Update lastAccessedAt for this membership
  await db
    .update(organizationMemberships)
    .set({ lastAccessedAt: new Date() })
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, auth.user.id)
      )
    )

  const updated = await refreshSession(event, organizationId)
  return updated
})

