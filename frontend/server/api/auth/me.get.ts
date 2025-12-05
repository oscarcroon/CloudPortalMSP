import { defineEventHandler } from 'h3'
import { requireSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const auth = await requireSession(event)
  return auth
})

