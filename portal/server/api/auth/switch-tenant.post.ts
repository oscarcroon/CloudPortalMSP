import { createError, defineEventHandler, readBody } from 'h3'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { requireSession } from '../../utils/session'
import { getDb } from '../../utils/db'
import { tenantMemberships, tenants, tenantAuthSettings } from '../../database/schema'

const schema = z.object({
  tenantId: z.string().min(1).nullable()
})

export default defineEventHandler(async (event) => {
  const { tenantId } = schema.parse(await readBody(event))
  const auth = await requireSession(event)

  if (!tenantId) {
    // Clearing tenant context
    const { refreshSession } = await import('../../utils/session')
    const updated = await refreshSession(event, auth.currentOrgId, null)
    return updated
  }

  // Verify user has access to this tenant
  const db = getDb()
  const [membership] = await db
    .select()
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, auth.user.id),
        eq(tenantMemberships.tenantId, tenantId),
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
      type: tenants.type
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))

  if (!target) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  const { refreshSession } = await import('../../utils/session')
  const updated = await refreshSession(event, auth.currentOrgId, tenantId)
  return updated
})

