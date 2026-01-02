import { defineEventHandler, createError } from 'h3'
import { ofetch } from 'ofetch'

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
export default defineEventHandler(async () => {
  const windowsDnsApiUrl = process.env.WINDOWS_DNS_API_URL
  const layerToken = process.env.WINDOWS_DNS_LAYER_TOKEN

  if (!windowsDnsApiUrl) {
    throw createError({
      statusCode: 500,
      message: 'WINDOWS_DNS_API_URL not configured'
    })
  }

  if (!layerToken) {
    throw createError({
      statusCode: 500,
      message: 'WINDOWS_DNS_LAYER_TOKEN not configured'
    })
  }

  try {
    // Fetch nameserver checks from the backend admin API
    const response = await ofetch<ApiListResponse<NameserverCheckStatus>>(
      `${windowsDnsApiUrl}/api/v1/admin/nameserver-checks`,
      {
        headers: {
          Authorization: `Bearer ${layerToken}`,
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
    if (error?.statusCode === 502 || error?.code === 'ECONNREFUSED') {
      console.warn('[windows-dns] NS check service unavailable, returning empty status')
      return {
        success: true,
        items: [],
        statusByZoneName: {},
        serviceUnavailable: true
      }
    }

    const statusCode = error?.statusCode ?? 500
    const message = error?.message ?? 'Failed to fetch NS check status'
    
    throw createError({ statusCode, message })
  }
})

