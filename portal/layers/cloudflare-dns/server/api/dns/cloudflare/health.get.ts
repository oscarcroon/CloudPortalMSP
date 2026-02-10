import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { ofetch } from 'ofetch'

/**
 * GET /api/dns/cloudflare/health
 *
 * Infrastructure-level health check for the Cloudflare integration.
 * Requires super admin or tenant admin auth (no org context needed).
 * Verifies that the Cloudflare API is reachable (no token needed — orgs use their own tokens).
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  const hasTenantAccess = auth && Object.keys(auth.tenantRoles).length > 0
  if (!auth?.user.isSuperAdmin && !hasTenantAccess) {
    throw createError({ statusCode: 403, message: 'Tenant admin required' })
  }

  const start = Date.now()
  try {
    // Ping the Cloudflare API base — any HTTP response (even 400/401) means it's reachable
    await ofetch.raw('https://api.cloudflare.com/client/v4/', {
      timeout: 5000
    })
    return {
      status: 'ok' as const,
      latency_ms: Date.now() - start
    }
  } catch (err: any) {
    const latency = Date.now() - start
    // An HTTP error response (4xx) still means the API is reachable
    if (err?.response?.status) {
      return {
        status: 'ok' as const,
        latency_ms: latency
      }
    }
    return {
      status: 'error' as const,
      latency_ms: latency,
      message: err?.message || 'Cloudflare API unreachable'
    }
  }
})
