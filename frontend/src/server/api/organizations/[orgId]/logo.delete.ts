import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { organizations } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'
import { requirePermission } from '~/server/utils/rbac'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(currentDir, '..', '..', '..', '..', '..')
const uploadsDir = process.env.UPLOADS_DIR || path.join(frontendRoot, 'uploads')
const uploadsRoot = path.join(uploadsDir, 'logos')

function deleteLogoFile(logoUrl: string | null | undefined) {
  if (!logoUrl) return

  try {
    // Hantera både /uploads/logos/ och /api/uploads/logos/
    const urlPath = logoUrl.includes('uploads/logos/') ? logoUrl.split('uploads/logos/')[1] : null
    if (!urlPath) return

    const filename = path.basename(urlPath.split('?')[0]) // Ta bort query params om de finns
    const filePath = path.join(uploadsRoot, filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.warn('[logo] Failed to delete logo file', error)
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

