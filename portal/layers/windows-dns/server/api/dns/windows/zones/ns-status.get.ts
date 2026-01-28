import { defineEventHandler, createError } from 'h3'
import { ofetch } from 'ofetch'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'

/**
 * Nameserver check status for a zone
 */
export interface NameserverCheckStatus {
  zoneId: string
  zoneName: string
  serverId: string
  lastCheckedAt: number | null
  delegationNameservers: string[]
  pointsToOurNameservers: boolean
  ourNameserversDetected: string[]
  policy: 'ANY' | 'QUORUM' | 'ALL'
  checkStatus: 'success' | 'error' | 'timeout'
  errorMessage: string | null
}

interface ApiListResponse<T> {
  success: boolean
  errors?: { code: string; message: string }[]
  result?: T[]
}

/**
 * GET /api/dns/windows/zones/ns-status
 * 
 * Fetches nameserver check status from the WindowsDNS backend.
 * Used to show pending/active delegation status for zones.
 */
export default defineEventHandler(async (event) => {
  // Require an authenticated portal session (same as other windows-dns endpoints)
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const moduleRights = await getWindowsDnsModuleAccessForUser(auth.currentOrgId, auth.user.id)
  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view Windows DNS zones.' })
  }

  const windowsDnsApiUrl = process.env.WINDOWS_DNS_API_URL
  // Admin endpoints in WindowsDNS backend are protected by x-admin-key / Authorization (adminAuth).
  const adminKey = (process.env.WINDOWS_DNS_ADMIN_KEY || process.env.ADMIN_API_KEY || '').trim()

  // NS status is an optional feature; degrade gracefully if not configured.
  if (!windowsDnsApiUrl || !adminKey) {
    return {
      success: true,
      items: [],
      statusByZoneName: {},
      serviceUnavailable: true,
      reason: !windowsDnsApiUrl
        ? 'WINDOWS_DNS_API_URL not configured'
        : 'WINDOWS_DNS_ADMIN_KEY not configured'
    }
  }

  try {
    const baseUrl = windowsDnsApiUrl.replace(/\/$/, '')
    // Be tolerant to both styles of WINDOWS_DNS_API_URL:
    // - .../api/v1  (recommended)
    // - ...         (legacy)
    const adminEndpoint = baseUrl.endsWith('/api/v1')
      ? `${baseUrl}/admin/nameserver-checks`
      : `${baseUrl}/api/v1/admin/nameserver-checks`

    // Fetch nameserver checks from the backend admin API
    const response = await ofetch<ApiListResponse<NameserverCheckStatus>>(
      adminEndpoint,
      {
        headers: {
          'x-admin-key': adminKey,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response?.success) {
      const errorMessage = response?.errors?.[0]?.message ?? 'Failed to fetch NS check status'
      throw createError({ statusCode: 502, message: errorMessage })
    }

    // Return the items as a map keyed by zoneName for easy lookup
    const items = response.result ?? []
    const statusByZoneName: Record<string, NameserverCheckStatus> = {}
    
    for (const item of items) {
      statusByZoneName[item.zoneName.toLowerCase()] = item
    }

    return {
      success: true,
      items,
      statusByZoneName
    }
  } catch (error: any) {
    // If the backend is unavailable, return empty status gracefully
    // This allows the UI to work even if NS-check service is down
    const upstreamStatus = error?.response?.status ?? error?.statusCode
    if (upstreamStatus === 502 || error?.code === 'ECONNREFUSED') {
      console.warn('[windows-dns] NS check service unavailable, returning empty status')
      return {
        success: true,
        items: [],
        statusByZoneName: {},
        serviceUnavailable: true
      }
    }

    // Avoid leaking upstream auth details; treat as a backend integration error.
    if (upstreamStatus === 401) {
      throw createError({
        statusCode: 502,
        message: 'Windows DNS NS status backend rejected admin key. Check WINDOWS_DNS_ADMIN_KEY.'
      })
    }

    const statusCode = upstreamStatus ?? 500
    const message = error?.data?.errors?.[0]?.message ?? error?.message ?? 'Failed to fetch NS check status'
    
    throw createError({ statusCode, message })
  }
})

