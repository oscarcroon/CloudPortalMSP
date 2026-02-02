/**
 * POST /api/admin/domain-verification/check
 * 
 * Manually trigger domain verification check (for super admins)
 */
import { defineEventHandler, createError } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { runDomainVerificationCheck } from '~~/server/lib/domain-verification/scheduler'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  
  if (!auth?.user.isSuperAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Endast superadmins kan trigga manuell domänverifiering.'
    })
  }
  
  console.log('[domain-verification] Manual check triggered by', auth.user.email)
  
  const result = await runDomainVerificationCheck()
  
  return {
    success: true,
    ...result,
    message: `Verifiering genomförd: ${result.checked} kontrollerade, ${result.verified} verifierade, ${result.failed} väntande.`
  }
})
