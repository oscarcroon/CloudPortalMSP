/**
 * POST /api/admin/tenants/:tenantId/news/:postId/hero-image
 *
 * Uploads a hero image for a news post.
 * Accepts multipart form data with a 'heroImage' file field.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readMultipartFormData } from 'h3'
import { createId } from '@paralleldrive/cuid2'
import { tenantNewsPosts } from '../../../../../../database/schema'
import { getDb } from '../../../../../../utils/db'
import { requireTenantPermission } from '../../../../../../utils/rbac'
import { ensureAuthState } from '../../../../../../utils/session'
import { logTenantAction } from '../../../../../../utils/audit'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif'
])

// Setup upload directory
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const portalRoot = path.resolve(currentDir, '..', '..', '..', '..', '..', '..', '..')
const uploadsDir = process.env.UPLOADS_DIR || path.join(portalRoot, 'uploads')
const newsImagesDir = path.join(uploadsDir, 'news')
fs.mkdirSync(newsImagesDir, { recursive: true })

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  const postId = getRouterParam(event, 'postId')

  if (!tenantId || !postId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID or post ID' })
  }

  await requireTenantPermission(event, 'tenants:manage', tenantId)
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()

  // Find the post and verify ownership
  const [post] = await db
    .select()
    .from(tenantNewsPosts)
    .where(and(eq(tenantNewsPosts.id, postId), eq(tenantNewsPosts.sourceTenantId, tenantId)))
    .limit(1)

  if (!post) {
    throw createError({ statusCode: 404, message: 'News post not found' })
  }

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'Hero image file required' })
  }

  const imageField = formData.find((field) => field.name === 'heroImage')
  if (!imageField || !imageField.filename) {
    throw createError({ statusCode: 400, message: 'Hero image file required' })
  }

  // Validate file size
  if (imageField.data.length > MAX_FILE_SIZE_BYTES) {
    throw createError({
      statusCode: 400,
      message: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`
    })
  }

  // Validate file type
  const ext = path.extname(imageField.filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw createError({
      statusCode: 400,
      message: `Invalid file type. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`
    })
  }

  if (imageField.type && !ALLOWED_MIME_TYPES.has(imageField.type)) {
    throw createError({
      statusCode: 400,
      message: `Invalid MIME type. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`
    })
  }

  // Generate unique filename
  const uniqueId = createId()
  const filename = `${tenantId}-${postId}-${uniqueId}${ext}`
  const filePath = path.join(newsImagesDir, filename)

  // Save file
  await fs.promises.writeFile(filePath, imageField.data)

  // Generate URL
  const heroImageUrl = `/api/uploads/news/${filename}`

  // Update post
  const now = new Date()
  await db
    .update(tenantNewsPosts)
    .set({
      heroImageUrl,
      updatedAt: now,
      updatedByUserId: auth.user.id
    })
    .where(eq(tenantNewsPosts.id, postId))

  const [updatedPost] = await db.select().from(tenantNewsPosts).where(eq(tenantNewsPosts.id, postId))

  await logTenantAction(
    event,
    'NEWS_HERO_IMAGE_UPLOADED',
    {
      postId,
      title: post.title,
      filename
    },
    tenantId
  )

  return { post: updatedPost, heroImageUrl }
})

