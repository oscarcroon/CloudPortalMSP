import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { requireSession } from '~~/server/utils/session'
import { sanitizeModuleIdList } from '~~/server/utils/modules'
import { getDb } from '~~/server/utils/db'
import { userModuleFavorites } from '~~/server/database/schema'

const requestSchema = z.object({
  modules: z.array(z.string()).max(24).optional().default([])
})

export default defineEventHandler(async (event) => {
  const auth = await requireSession(event)
  const body = await readBody(event).catch(() => ({}))
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Ogiltig lista med favoritmoduler.' })
  }

  const favoriteModules = sanitizeModuleIdList(parsed.data.modules, { max: 24 })
  const db = getDb()

  // Delete existing favorites for this user
  await db.delete(userModuleFavorites).where(eq(userModuleFavorites.userId, auth.user.id))
  
  // Insert new favorites if any
  if (favoriteModules.length > 0) {
    await db.insert(userModuleFavorites).values(
      favoriteModules.map((moduleId, index) => ({
        id: createId(),
        userId: auth.user.id,
        moduleId,
        displayOrder: index
      }))
    )
  }

  auth.favoriteModules = favoriteModules
  event.context.auth = auth

  return { favoriteModules }
})


