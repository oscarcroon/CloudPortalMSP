import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { organizations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(currentDir, '..', '..', '..', '..', '..')
const uploadsDir = process.env.UPLOADS_DIR || path.join(frontendRoot, 'uploads')
const uploadsRoot = path.join(uploadsDir, 'logos')

function deleteLogoFile(logoUrl: string | null | undefined) {
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

    console.log('[logo] Deleting logo file:', filename)

    // Försök radera från primär katalog (där filerna normalt sparas)
    const primaryPath = path.join(uploadsRoot, filename)
    if (fs.existsSync(primaryPath)) {
      fs.unlinkSync(primaryPath)
      console.log('[logo] Deleted logo file from primary location:', primaryPath)
      return
    }

    // Fallback: försök i backend/uploads/logos om filen inte hittas i primärkatalogen
    const backendRoot = path.resolve(frontendRoot, '..', 'backend')
    const backendUploadsDir = process.env.UPLOADS_DIR || path.join(backendRoot, 'uploads')
    const backendLogosDir = path.join(backendUploadsDir, 'logos')
    const fallbackPath = path.join(backendLogosDir, filename)
    
    if (fs.existsSync(fallbackPath)) {
      fs.unlinkSync(fallbackPath)
      console.log('[logo] Deleted logo file from fallback location:', fallbackPath)
      return
    }

    console.warn('[logo] Logo file not found in primary or fallback location:', primaryPath, fallbackPath)
  } catch (error) {
    console.error('[logo] Failed to delete logo file', error)
  }
}

export default defineEventHandler(async (event) => {
  const { orgId } = await requirePermission(event, 'org:manage')
  const paramOrgId = getRouterParam(event, 'orgId')
  if (paramOrgId !== orgId) {
    throw createError({ statusCode: 403, message: 'Kan inte ta bort logotyp för denna organisation.' })
  }

  const db = getDb()
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organisationen kunde inte hittas.' })
  }

  deleteLogoFile(organization.logoUrl)

  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  if (isSqlite) {
    db.update(organizations).set({ logoUrl: null, updatedAt: new Date() }).where(eq(organizations.id, orgId)).run()
  } else {
    await db.update(organizations).set({ logoUrl: null, updatedAt: new Date() }).where(eq(organizations.id, orgId))
  }

  return { success: true }
})

