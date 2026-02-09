import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { ofetch } from 'ofetch'

/**
 * GET /api/dns/cloudflare/health
 *
 * Infrastructure-level health check for the Cloudflare integration.
 * Requires super admin or tenant admin auth (no org context needed).
 * Checks: CLOUDFLARE_TOKEN exists + calls Cloudflare GET /user/tokens/verify.
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  const hasTenantAccess = auth && Object.keys(auth.tenantRoles).length > 0
  if (!auth?.user.isSuperAdmin && !hasTenantAccess) {
    throw createError({ statusCode: 403, message: 'Tenant admin required' })
  }

  const token = process.env.CLOUDFLARE_TOKEN

  if (!token) {
    return {
      status: 'unconfigured' as const,
      latency_ms: 0,
      message: 'CLOUDFLARE_TOKEN not set'
    }
  }

  const start = Date.now()
  try {
    await ofetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { Authorization: `Bearer ${token}` }
    })
    return {
      status: 'ok' as const,
      latency_ms: Date.now() - start
    }
  } catch (err: any) {
    return {
      status: 'error' as const,
      latency_ms: Date.now() - start,
      message: err?.data?.errors?.[0]?.message || err?.message || 'Token verification failed'
    }
  }
})
