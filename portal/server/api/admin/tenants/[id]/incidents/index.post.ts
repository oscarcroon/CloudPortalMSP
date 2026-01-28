/**
 * POST /api/admin/tenants/:tenantId/incidents
 *
 * Creates a new incident for a tenant.
 * Only distributors and providers can create incidents.
 */

import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { tenantIncidents, tenants } from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { requireTenantPermission } from '../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../utils/session'
import { logTenantAction } from '../../../../../utils/audit'
import { createId } from '@paralleldrive/cuid2'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const createIncidentSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(slugRegex, 'Slug must be lowercase and may only contain hyphens.')
    .optional(),
  bodyMarkdown: z.string().max(10000).optional().nullable(),
  severity: z.enum(['critical', 'outage', 'notice', 'maintenance', 'planned']).default('notice'),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable()
})

/**
 * Generates a URL-friendly slug from a title.
 */
function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9åäöæøü]+/gi, '-')
    .replace(/[åäàáâã]/g, 'a')
    .replace(/[öøòóô]/g, 'o')
    .replace(/[æ]/g, 'ae')
    .replace(/[ü]/g, 'u')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
}

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  await requireTenantPermission(event, 'tenants:manage', tenantId)
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()

  // Verify tenant exists and is distributor or provider
  const [tenant] = await db
    .select({ type: tenants.type })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  if (tenant.type === 'organization') {
    throw createError({
      statusCode: 403,
      message: 'Only distributors and providers can create incidents'
    })
  }

  const payload = createIncidentSchema.parse(await readBody(event))

  // Generate or use provided slug
  let slug = payload.slug || generateSlug(payload.title)

  // Handle slug collisions within the same tenant
  let slugSuffix = 0
  let finalSlug = slug
  while (true) {
    const [existing] = await db
      .select({ id: tenantIncidents.id })
      .from(tenantIncidents)
      .where(
        and(eq(tenantIncidents.sourceTenantId, tenantId), eq(tenantIncidents.slug, finalSlug))
      )
      .limit(1)

    if (!existing) break
    slugSuffix++
    finalSlug = `${slug}-${slugSuffix}`
  }

  const incidentId = createId()
  const now = new Date()

  await db.insert(tenantIncidents).values({
    id: incidentId,
    sourceTenantId: tenantId,
    title: payload.title,
    slug: finalSlug,
    bodyMarkdown: payload.bodyMarkdown ?? null,
    severity: payload.severity,
    status: 'active',
    startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
    endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
    createdByUserId: auth.user.id,
    updatedByUserId: auth.user.id,
    createdAt: now,
    updatedAt: now
  })

  const [incident] = await db
    .select()
    .from(tenantIncidents)
    .where(eq(tenantIncidents.id, incidentId))

  await logTenantAction(
    event,
    'INCIDENT_CREATED',
    {
      incidentId,
      title: payload.title,
      severity: payload.severity
    },
    tenantId
  )

  return { incident }
})

