import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getOrgConfig } from '@windows-dns/server/lib/windows-dns/org-config'

/**
 * GET /api/dns/windows/servers
 * 
 * Returns the list of available Windows DNS servers for zone creation.
 */
export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view DNS.' })
  }

  const config = await getOrgConfig(orgId)
  if (!config?.windowsDnsAccountId) {
    throw createError({ statusCode: 400, message: 'DNS not configured for this organization.' })
  }

  // Call the Windows DNS layer to get servers via system endpoint
  const baseUrl = process.env.WINDOWS_DNS_API_URL
  const layerToken = process.env.WINDOWS_DNS_LAYER_TOKEN

  if (!baseUrl || !layerToken) {
    throw createError({ statusCode: 500, message: 'DNS layer not configured (missing WINDOWS_DNS_API_URL or WINDOWS_DNS_LAYER_TOKEN).' })
  }

  try {
    const response = await ($fetch as any)(`${baseUrl}/system/servers`, {
      headers: {
        'Authorization': `Bearer ${layerToken}`
      }
    }) as { result: { servers: any[] } }

    // API returns { result: { servers: [...] } }
    const servers = (response.result?.servers || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      baseUrl: s.baseUrl,
      isEnabled: s.isEnabled
    }))

    return { servers }
  } catch (error: any) {
    console.error('[windows-dns] Failed to fetch servers:', error?.message)
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to fetch servers.'
    })
  }
})

