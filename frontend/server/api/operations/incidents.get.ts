/**
 * GET /api/operations/incidents
 *
 * Returns all incidents for the current context with detailed mute information.
 * This endpoint is designed for "view all" pages where users can see and manage
 * hidden incidents.
 *
 * Query parameters:
 * - includeMuted: '1' to include muted incidents (default: true for this endpoint)
 * - status: 'active' | 'resolved' | 'all' (default: 'active')
 */

import { defineEventHandler, getQuery } from 'h3'
import { ensureAuthState } from '../../utils/session'
import { getEffectiveFeed } from '../../utils/operations/feedResolver'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)

  // If not authenticated, return empty list
  if (!auth) {
    return {
      incidents: [],
      context: { type: 'none' }
    }
  }

  const query = getQuery(event)
  const includeMuted = query.includeMuted !== '0' // Default true for this endpoint
  const statusFilter = (query.status as string) || 'active'

  // Get the current context from auth state
  const currentOrgId = auth.currentOrgId ?? null
  const currentTenantId = auth.currentTenantId ?? null
  const currentUserId = auth.user.id

  const feed = await getEffectiveFeed({
    currentOrgId,
    currentTenantId,
    currentUserId,
    includeMutedIncidents: includeMuted,
    newsLimit: 0, // We don't need news for this endpoint
    plannedDaysAhead: 30 // Show planned incidents further ahead in list view
  })

  // Filter by status if needed
  let incidents = feed.activeIncidents
  if (statusFilter === 'resolved') {
    incidents = incidents.filter((i) => i.status === 'resolved')
  } else if (statusFilter === 'active') {
    incidents = incidents.filter((i) => i.status === 'active')
  }
  // 'all' = no filter

  return {
    incidents: incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      bodyMarkdown: incident.bodyMarkdown,
      severity: incident.severity,
      status: incident.status,
      startsAt: incident.startsAt,
      endsAt: incident.endsAt,
      createdAt: incident.createdAt,
      sourceTenantId: incident.sourceTenantId,
      sourceTenantName: incident.sourceTenantName,
      sourceTenantType: incident.sourceTenantType,
      isUserMuted: incident.isUserMuted,
      isScopeMuted: incident.isScopeMuted,
      isMuted: incident.isMuted,
      isPlanned: incident.isPlanned
    })),
    context: {
      type: feed.sources.contextType,
      orgId: feed.sources.orgId,
      tenantId: feed.sources.tenantId,
      sourceCount: feed.sources.sourceIds.length
    }
  }
})

