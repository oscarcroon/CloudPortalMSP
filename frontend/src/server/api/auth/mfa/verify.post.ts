import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { verifyAndCreateMfaSession } from '../../../utils/mfa'
import { rateLimiters } from '../../../utils/rateLimit'
import { logMfaStepUp } from '../../../utils/audit'

const schema = z.object({
  code: z.string().min(6).max(6),
  scope: z.enum(['tenant', 'org', 'global']),
  scopeId: z.string().optional(),
  method: z.enum(['totp', 'sms', 'email']).default('totp')
})

export default defineEventHandler(async (event) => {
  // Apply rate limiting
  await rateLimiters.mfaVerify(event)

  const body = schema.parse(await readBody(event))
  
  const scopeString = body.scope === 'global' ? 'global' : `${body.scope}:${body.scopeId}`
  
  const result = await verifyAndCreateMfaSession(
    event,
    body.code,
    body.scope,
    body.scopeId,
    body.method
  )

  // Log MFA step-up attempt
  await logMfaStepUp(event, scopeString, result.success)

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'MFA_VERIFICATION_FAILED'
    }
  }

  return {
    success: true,
    mfaSessionId: result.mfaSessionId
  }
})

