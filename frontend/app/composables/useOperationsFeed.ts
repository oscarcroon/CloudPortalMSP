/**
 * Composable for fetching and managing the operations feed (incidents & news).
 */

import { ref, computed } from 'vue'

export interface FeedIncident {
  id: string
  title: string
  bodyMarkdown: string | null
  severity: 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned'
  status: 'active' | 'resolved'
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  sourceTenantId: string
  sourceTenantName: string
  sourceTenantType: 'provider' | 'distributor' | 'organization'
  isMuted: boolean
  isPlanned: boolean
}

export interface FeedNewsPost {
  id: string
  title: string
  slug: string
  summary: string | null
  heroImageUrl: string | null
  bodyMarkdown: string | null
  publishedAt: string | null
  sourceTenantId: string
  sourceTenantName: string
  sourceTenantType: 'provider' | 'distributor' | 'organization'
}

export interface OperationsFeedResponse {
  activeIncidents: FeedIncident[]
  latestNews: FeedNewsPost[]
  context: {
    type: 'organization' | 'tenant' | 'none'
    orgId?: string
    tenantId?: string
    sourceCount: number
  }
}

export function useOperationsFeed() {
  const feed = ref<OperationsFeedResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeIncidents = computed(() => feed.value?.activeIncidents ?? [])
  const latestNews = computed(() => feed.value?.latestNews ?? [])
  const hasActiveIncidents = computed(() => activeIncidents.value.length > 0)

  async function fetchFeed() {
    // Only run on client
    if (import.meta.server) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await $fetch<OperationsFeedResponse>('/api/operations/feed', {
        credentials: 'include'
      })
      feed.value = response
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch operations feed'
      console.error('[useOperationsFeed] Error fetching feed:', err)
    } finally {
      loading.value = false
    }
  }

  async function muteIncident(incidentId: string, targetType: 'organization' | 'tenant' = 'organization') {
    try {
      await $fetch(`/api/admin/incidents/${incidentId}/mute`, {
        method: 'POST',
        body: { targetType },
        credentials: 'include'
      })
      // Refresh feed after muting
      await fetchFeed()
    } catch (err: any) {
      console.error('[useOperationsFeed] Error muting incident:', err)
      throw err
    }
  }

  async function unmuteIncident(incidentId: string, targetType: 'organization' | 'tenant' = 'organization') {
    try {
      await $fetch(`/api/admin/incidents/${incidentId}/unmute`, {
        method: 'POST',
        body: { targetType },
        credentials: 'include'
      })
      // Refresh feed after unmuting
      await fetchFeed()
    } catch (err: any) {
      console.error('[useOperationsFeed] Error unmuting incident:', err)
      throw err
    }
  }

  // Note: fetchFeed should be called explicitly by the consumer
  // to avoid duplicate calls and timing issues

  return {
    feed,
    loading,
    error,
    activeIncidents,
    latestNews,
    hasActiveIncidents,
    fetchFeed,
    muteIncident,
    unmuteIncident
  }
}

