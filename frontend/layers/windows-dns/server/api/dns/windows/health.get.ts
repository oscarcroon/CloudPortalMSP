import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getOrgConfig, getOrgCoreId } from '@windows-dns/server/lib/windows-dns/org-config'
import { systemRequest } from '@windows-dns/server/lib/windows-dns/client'

/**
 * GET /api/dns/windows/health
 * 
 * Health check endpoint to verify WindowsDNS layer connectivity and configuration.
 */
export default defineEventHandler(async (event) => {
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


