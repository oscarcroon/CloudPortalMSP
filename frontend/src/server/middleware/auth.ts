import { defineEventHandler } from 'h3'
import { ensureAuthState } from '../utils/session'

export default defineEventHandler(async (event) => {
  try {
    await ensureAuthState(event)
  } catch (error) {
    console.error('Auth middleware error', error)
    throw error
  }
})

