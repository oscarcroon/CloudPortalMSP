import { defineEventHandler } from 'h3'
import { destroySession } from '../../utils/session'

export default defineEventHandler((event) => {
  destroySession(event)
  return { success: true }
})

