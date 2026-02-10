import { createError, defineEventHandler, getQuery } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getOrgConfig, getOrgCoreId } from '@windows-dns/server/lib/windows-dns/org-config'
import { systemRequest } from '@windows-dns/server/lib/windows-dns/client'
import { ofetch } from 'ofetch'

/**
 * GET /api/dns/windows/health
 *
 * Health check endpoint for the Windows DNS layer.
 *
 * Two modes:
 * - ?mode=infra  — Infrastructure-level check (super admin only, no org context).
 *                   Checks env vars + basic layer reachability.
 * - default      — Org-level check (requires org context + view permission).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const mode = query.mode as string | undefined

  // Infrastructure-level health check (tenant-admin system health card)
  if (mode === 'infra') {
    const auth = await ensureAuthState(event)
    const hasTenantAccess = auth && Object.keys(auth.tenantRoles).length > 0
    if (!auth?.user.isSuperAdmin && !hasTenantAccess) {
      throw createError({ statusCode: 403, message: 'Tenant admin required' })
    }

    const layerUrl = process.env.WINDOWS_DNS_API_URL
    const layerToken = process.env.WINDOWS_DNS_LAYER_TOKEN

    if (!layerUrl || !layerToken) {
      return {
        status: 'unconfigured' as const,
        latency_ms: 0,
        message: !layerUrl ? 'WINDOWS_DNS_API_URL not set' : 'WINDOWS_DNS_LAYER_TOKEN not set'
      }
    }

    const start = Date.now()
    try {
      await ofetch(`${layerUrl}/admin/health`, {
        headers: { 'x-admin-key': layerToken },
        timeout: 5000
      })
      return {
        status: 'ok' as const,
        latency_ms: Date.now() - start
      }
    } catch (err: any) {
      return {
        status: 'error' as const,
        latency_ms: Date.now() - start,
        message: err?.message || 'Layer unreachable'
      }
    }
  }

  // Org-level health check (original behavior)
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view DNS status.' })
  }

  const coreId = await getOrgCoreId(orgId)
  const config = await getOrgConfig(orgId)

  const health: {
    coreId: string | null
    hasCoreId: boolean
    configExists: boolean
    accountId: string | null
    layerUrl: string | null
    layerTokenConfigured: boolean
    layerReachable: boolean
    layerError?: string
  } = {
    coreId,
    hasCoreId: !!coreId,
    configExists: !!config,
    accountId: config?.windowsDnsAccountId ?? null,
    layerUrl: process.env.WINDOWS_DNS_API_URL ?? null,
    layerTokenConfigured: !!process.env.WINDOWS_DNS_LAYER_TOKEN,
    layerReachable: false
  }

  // Try to reach the layer (simple system endpoint check)
  if (health.layerUrl && health.layerTokenConfigured) {
    try {
      // Try a simple system request (this will fail if layer is unreachable)
      await systemRequest(config?.instanceId, '/accounts/ensure', {
        method: 'POST',
        body: {
          name: 'health-check',
          externalRef: 'health-check-test'
        }
      })
      health.layerReachable = true
    } catch (error: any) {
      health.layerReachable = false
      health.layerError = error?.message || 'Unknown error'
    }
  }

  return health
})
