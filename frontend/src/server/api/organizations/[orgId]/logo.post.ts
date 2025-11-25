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
    // Extrahera filnamnet från URL:en
    let filename: string | null = null
    
    // Hantera olika URL-format
    if (logoUrl.includes('/api/uploads/logos/')) {
      const parts = logoUrl.split('/api/uploads/logos/')
      if (parts.length > 1) {
        filename = path.basename(parts[1].split('?')[0])
      }
    } else if (logoUrl.includes('uploads/logos/')) {
      const parts = logoUrl.split('uploads/logos/')
      if (parts.length > 1) {
        filename = path.basename(parts[1].split('?')[0])
      }
    } else if (logoUrl.includes('/uploads/logos/')) {
      const parts = logoUrl.split('/uploads/logos/')
      if (parts.length > 1) {
        filename = path.basename(parts[1].split('?')[0])
      }
    }

    if (!filename || filename === '/' || filename === '') {
      console.warn('[logo] Could not extract filename from logo URL:', logoUrl)
      return
    }

    console.log('[logo] Deleting existing logo file:', filename)

    // Försök radera från primär katalog (där filerna normalt sparas)
    const primaryPath = path.join(uploadsRoot, filename)
    if (fs.existsSync(primaryPath)) {
      fs.unlinkSync(primaryPath)
      console.log('[logo] Deleted existing logo file from primary location:', primaryPath)
      return
    }

    // Fallback: försök i backend/uploads/logos om filen inte hittas i primärkatalogen
    const backendRoot = path.resolve(frontendRoot, '..', 'backend')
    const backendUploadsDir = process.env.UPLOADS_DIR || path.join(backendRoot, 'uploads')
    const backendLogosDir = path.join(backendUploadsDir, 'logos')
    const fallbackPath = path.join(backendLogosDir, filename)
    
    if (fs.existsSync(fallbackPath)) {
      fs.unlinkSync(fallbackPath)
      console.log('[logo] Deleted existing logo file from fallback location:', fallbackPath)
      return
    }

    console.warn('[logo] Existing logo file not found in primary or fallback location:', primaryPath, fallbackPath)
  } catch (error) {
    console.error('[logo] Failed to delete previous logo', error)
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

