/**
 * POST /api/admin/tenants/:tenantId/news
 *
 * Creates a new news post (draft by default).
 * Only distributors and providers can create news posts.
 */

import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { tenantNewsPosts, tenants } from '../../../../../database/schema'
import { getDb } from '../../../../../utils/db'
import { requireTenantPermission } from '../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../utils/session'
import { logTenantAction } from '../../../../../utils/audit'
import { createId } from '@paralleldrive/cuid2'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const createNewsSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(slugRegex, 'Slug måste vara lowercase och får endast innehålla bindestreck.')
    .optional(),
  summary: z.string().max(500).optional().nullable(),
  bodyMarkdown: z.string().max(50000).optional().nullable(),
  heroImageUrl: z.string().url().max(2000).optional().nullable()
})

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
      message: 'Only distributors and providers can create news posts'
    })
  }

  const payload = createNewsSchema.parse(await readBody(event))

  // Generate slug if not provided
  let slug = payload.slug || generateSlug(payload.title)

  // Ensure slug is unique within this tenant
  let slugSuffix = 0
  let finalSlug = slug
  while (true) {
    const [existing] = await db
      .select({ id: tenantNewsPosts.id })
      .from(tenantNewsPosts)
      .where(
        and(eq(tenantNewsPosts.sourceTenantId, tenantId), eq(tenantNewsPosts.slug, finalSlug))
      )
      .limit(1)

    if (!existing) break
    slugSuffix++
    finalSlug = `${slug}-${slugSuffix}`
  }

  const postId = createId()
  const now = new Date()

  await db.insert(tenantNewsPosts).values({
    id: postId,
    sourceTenantId: tenantId,
    title: payload.title,
    slug: finalSlug,
    summary: payload.summary ?? null,
    bodyMarkdown: payload.bodyMarkdown ?? null,
    heroImageUrl: payload.heroImageUrl ?? null,
    status: 'draft',
    createdByUserId: auth.user.id,
    updatedByUserId: auth.user.id,
    createdAt: now,
    updatedAt: now
  })

  const [post] = await db.select().from(tenantNewsPosts).where(eq(tenantNewsPosts.id, postId))

  await logTenantAction(
    event,
    'NEWS_CREATED',
    {
      postId,
      title: payload.title,
      slug: finalSlug
    },
    tenantId
  )

  return { post }
})

