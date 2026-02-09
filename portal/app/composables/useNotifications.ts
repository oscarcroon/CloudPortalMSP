/**
 * Composable for managing notification bell state.
 * Reuses useOperationsFeed() singleton for data and tracks "last viewed" time in localStorage.
 */

import { computed, watch } from 'vue'
import { useOperationsFeed, type FeedIncident, type FeedNewsPost } from './useOperationsFeed'

const STORAGE_KEY = 'notification_last_viewed_at'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Get the "last viewed" timestamp from localStorage.
 */
function getLastViewedAt(): number {
  if (import.meta.server) return 0
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? parseInt(stored, 10) : 0
}

/**
 * Set the "last viewed" timestamp in localStorage.
 */
function setLastViewedAt(timestamp: number): void {
  if (import.meta.server) return
  localStorage.setItem(STORAGE_KEY, timestamp.toString())
}

export function useNotifications() {
  const feed = useOperationsFeed()

  // Get items from the last 7 days only
  const recentIncidents = computed(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS
    return feed.activeIncidents.value.filter((incident) => {
      const createdAt = new Date(incident.createdAt).getTime()
      return createdAt > cutoff
    })
  })

  const recentNews = computed(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS
    return feed.latestNews.value.filter((news) => {
      const publishedAt = news.publishedAt ? new Date(news.publishedAt).getTime() : 0
      return publishedAt > cutoff
    })
  })

  // Unread = created after lastViewedAt
  const unreadIncidents = computed(() => {
    const lastViewed = getLastViewedAt()
    return recentIncidents.value.filter((incident) => {
      const createdAt = new Date(incident.createdAt).getTime()
      return createdAt > lastViewed
    })
  })

  const unreadNews = computed(() => {
    const lastViewed = getLastViewedAt()
    return recentNews.value.filter((news) => {
      const publishedAt = news.publishedAt ? new Date(news.publishedAt).getTime() : 0
      return publishedAt > lastViewed
    })
  })

  const unreadCount = computed(() => {
    return unreadIncidents.value.length + unreadNews.value.length
  })

  const hasUnread = computed(() => unreadCount.value > 0)

  // Format badge text: 1-9, then "9+"
  const badgeText = computed(() => {
    const count = unreadCount.value
    if (count === 0) return ''
    if (count > 9) return '9+'
    return count.toString()
  })

  /**
   * Mark all notifications as seen by updating the lastViewedAt timestamp.
   */
  function markAllSeen(): void {
    setLastViewedAt(Date.now())
  }

  /**
   * Check if an incident is unread.
   */
  function isIncidentUnread(incident: FeedIncident): boolean {
    const lastViewed = getLastViewedAt()
    const createdAt = new Date(incident.createdAt).getTime()
    return createdAt > lastViewed
  }

  /**
   * Check if a news post is unread.
   */
  function isNewsUnread(news: FeedNewsPost): boolean {
    const lastViewed = getLastViewedAt()
    const publishedAt = news.publishedAt ? new Date(news.publishedAt).getTime() : 0
    return publishedAt > lastViewed
  }

  return {
    // Data from feed
    feed,
    recentIncidents,
    recentNews,

    // Unread tracking
    unreadIncidents,
    unreadNews,
    unreadCount,
    hasUnread,
    badgeText,

    // Actions
    markAllSeen,
    isIncidentUnread,
    isNewsUnread
  }
}
