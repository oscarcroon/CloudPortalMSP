import { createError, defineEventHandler, getRouterParam, readMultipartFormData } from 'h3'
import { eq } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { organizations } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { requirePermission } from '~/server/utils/rbac'

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp'])
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp'
])

// Använd .data/uploads för att matcha Nuxt's data directory
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(currentDir, '..', '..', '..', '..', '..')
const uploadsDir = process.env.UPLOADS_DIR || path.join(frontendRoot, 'uploads')
const uploadsRoot = path.join(uploadsDir, 'logos')
fs.mkdirSync(uploadsRoot, { recursive: true })

function getSafeExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase()
  return extension || '.png'
}

function buildLogoUrl(absolutePath: string) {
  const filename = path.basename(absolutePath)
  const baseUrl = process.env.PORTAL_BASE_URL || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl.replace(/\/$/, '')}/api/uploads/logos/${filename}`
}

function deleteExistingLogo(logoUrl: string | null | undefined) {
  if (!logoUrl) return

  try {
    const parsedUrl = new URL(logoUrl)
    const relativePath = parsedUrl.pathname.replace(/^\/+/, '')
    // Hantera både /uploads/logos/ och /api/uploads/logos/
    if (!relativePath.includes('uploads/logos/')) {
      return
    }
    const filename = path.basename(relativePath)
    const filePath = path.join(uploadsRoot, filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.warn('[logo] Failed to delete previous logo', error)
  }
}

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const paramOrgId = getRouterParam(event, 'orgId')
  if (paramOrgId !== orgId) {
    throw createError({ statusCode: 403, message: 'Kan inte ladda upp logotyp för denna organisation.' })
  }

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'Logotypfil krävs.' })
  }

  const logoField = formData.find((field) => field.name === 'logo')
  if (!logoField || !logoField.filename) {
    throw createError({ statusCode: 400, message: 'Logotypfil krävs.' })
  }

  const extension = getSafeExtension(logoField.filename)
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw createError({ statusCode: 400, message: 'Ogiltigt filformat. Tillåtna format: .jpg, .png, .svg, .webp.' })
  }

  if (logoField.type && !ALLOWED_MIME_TYPES.has(logoField.type)) {
    throw createError({ statusCode: 400, message: 'Ogiltigt filformat. Tillåtna format: .jpg, .png, .svg, .webp.' })
  }

  if (logoField.data.length > MAX_FILE_SIZE_BYTES) {
    throw createError({ statusCode: 400, message: 'Filen får vara max 2 MB.' })
  }

  const db = getDb()
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organisationen kunde inte hittas.' })
  }

  deleteExistingLogo(organization.logoUrl)

  const filename = `${orgId}-${Date.now()}${extension}`
  const filePath = path.join(uploadsRoot, filename)
  
  // Debug logging i utvecklingsläge
  if (import.meta.dev) {
    console.log('[logo-upload] Saving file to:', filePath)
    console.log('[logo-upload] Uploads root:', uploadsRoot)
    console.log('[logo-upload] Uploads root exists:', fs.existsSync(uploadsRoot))
  }
  
  fs.writeFileSync(filePath, logoField.data)

  const logoUrl = buildLogoUrl(filePath)
  
  if (import.meta.dev) {
    console.log('[logo-upload] Logo URL:', logoUrl)
  }

  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  if (isSqlite) {
    db.update(organizations).set({ logoUrl, updatedAt: new Date() }).where(eq(organizations.id, orgId)).run()
  } else {
    await db.update(organizations).set({ logoUrl, updatedAt: new Date() }).where(eq(organizations.id, orgId))
  }

  return { logoUrl }
})

