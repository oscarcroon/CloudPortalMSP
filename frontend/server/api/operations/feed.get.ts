/**
 * GET /api/operations/feed
 *
 * Returns the effective operations feed for the current context:
 * - Active incidents (filtered by mutes)
 * - Latest published news
 *
 * Uses the current org or tenant context from auth state.
 */

import { defineEventHandler } from 'h3'
import { ensureAuthState } from '../../utils/session'
import { getEffectiveFeed } from '../../utils/operations/feedResolver'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)

  // Get the current context from auth state
  const currentOrgId = auth?.currentOrgId ?? null
  const currentTenantId = auth?.currentTenantId ?? null

  // If not authenticated, return empty feed
  if (!auth) {
    return {
      activeIncidents: [],
      latestNews: [],
      context: { type: 'none' }
    }
  }

  const feed = await getEffectiveFeed({
    currentOrgId,
    currentTenantId,
    includeMutedIncidents: false,
    newsLimit: 3
  })

  return {
    activeIncidents: feed.activeIncidents,
    latestNews: feed.latestNews,
    context: {
      type: feed.sources.contextType,
      orgId: feed.sources.orgId,
      tenantId: feed.sources.tenantId,
      sourceCount: feed.sources.sourceIds.length
    }
  }
})

