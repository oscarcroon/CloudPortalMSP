import { defineEventHandler } from 'h3'
import { requireSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const auth = await requireSession(event)
  return { favoriteModules: auth.favoriteModules }
})


