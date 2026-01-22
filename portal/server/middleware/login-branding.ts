import { defineEventHandler } from 'h3'
import { resolveLoginBrandingContext } from '../utils/loginBrandingResolver'

export default defineEventHandler(async (event) => {
  try {
    await resolveLoginBrandingContext(event)
  } catch (error) {
    console.error('Login branding resolver failed', error)
  }
})

