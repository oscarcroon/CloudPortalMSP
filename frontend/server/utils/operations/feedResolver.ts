/**
 * Effective Feed Resolver for Operations
 *
 * Returns active incidents and latest news for a given context,
 * with mute filtering applied.
 */

import { eq, and, or, isNull, lte, gte, gt, inArray, desc, sql } from 'drizzle-orm'
import { getDb } from '../db'
import {
  tenantIncidents,
  tenantIncidentMutes,
  tenantNewsPosts,
  tenants,
  type IncidentSeverity,
  type IncidentStatus,
  type NewsPostStatus
} from '../../database/schema'
import { getUpstreamSources, getSourceTenantInfo, type UpstreamSourcesResult } from './upstreamSources'

// Severity ranking for sorting (lower = higher priority)
const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  critical: 0,
  outage: 1,
  maintenance: 2,
  planned: 3,
  notice: 4
}

export interface FeedIncident {
  id: string
  title: string
  bodyMarkdown: string | null
  severity: IncidentSeverity
  status: IncidentStatus
  startsAt: Date | null
  endsAt: Date | null
  createdAt: Date
  sourceTenantId: string
  sourceTenantName: string
  sourceTenantType: 'provider' | 'distributor' | 'organization'
  isMuted: boolean
  /** True if incident has startsAt in the future (planned maintenance) */
  isPlanned: boolean
}

// Default: Show planned incidents up to 7 days in advance
const DEFAULT_PLANNED_DAYS_AHEAD = 7

export interface FeedNewsPost {
  id: string
  title: string
  slug: string
  summary: string | null
  heroImageUrl: string | null
  bodyMarkdown: string | null
  publishedAt: Date | null
  sourceTenantId: string
  sourceTenantName: string
  sourceTenantType: 'provider' | 'distributor' | 'organization'
}

export interface OperationsFeedResult {
  activeIncidents: FeedIncident[]
  latestNews: FeedNewsPost[]
  sources: UpstreamSourcesResult
}

export interface GetFeedOptions {
  currentOrgId?: string | null
  currentTenantId?: string | null
  includeMutedIncidents?: boolean
  newsLimit?: number
  /** Days ahead to show planned incidents (default: 7) */
  plannedDaysAhead?: number
}

/**
 * Get the effective operations feed for a context.
 */
export async function getEffectiveFeed(opts: GetFeedOptions): Promise<OperationsFeedResult> {
  const sources = await getUpstreamSources({
    currentOrgId: opts.currentOrgId,
    currentTenantId: opts.currentTenantId
  })

  if (sources.sourceIds.length === 0) {
    return { activeIncidents: [], latestNews: [], sources }
  }

  const now = new Date()
  const plannedDaysAhead = opts.plannedDaysAhead ?? DEFAULT_PLANNED_DAYS_AHEAD

  // Fetch incidents and news in parallel
  const [incidents, news, tenantInfo] = await Promise.all([
    fetchActiveIncidents(sources.sourceIds, now, plannedDaysAhead),
    fetchLatestNews(sources.sourceIds, now, opts.newsLimit ?? 3),
    getSourceTenantInfo(sources.sourceIds)
  ])

  // Fetch mutes for the current scope
  const mutedIncidentIds = await getMutedIncidentIds({
    incidentIds: incidents.map((i) => i.id),
    contextType: sources.contextType,
    orgId: opts.currentOrgId ?? undefined,
    tenantId: opts.currentTenantId ?? undefined,
    now
  })

  // Build feed incidents with source info and mute status
  const activeIncidents: FeedIncident[] = incidents
    .map((incident) => {
      const sourceInfo = tenantInfo.get(incident.sourceTenantId)
      const isMuted = mutedIncidentIds.has(incident.id)
      // Incident is planned if startsAt is in the future
      const isPlanned = incident.startsAt ? incident.startsAt.getTime() > now.getTime() : false

      return {
        id: incident.id,
        title: incident.title,
        bodyMarkdown: incident.bodyMarkdown,
        severity: incident.severity as IncidentSeverity,
        status: incident.status as IncidentStatus,
        startsAt: incident.startsAt,
        endsAt: incident.endsAt,
        createdAt: incident.createdAt,
        sourceTenantId: incident.sourceTenantId,
        sourceTenantName: sourceInfo?.name ?? 'Unknown',
        sourceTenantType: sourceInfo?.type ?? 'provider',
        isMuted,
        isPlanned
      }
    })
    .filter((i) => opts.includeMutedIncidents || !i.isMuted)
    // Sort: active first, then planned; within each group by severity, then time
    .sort((a, b) => {
      // Active incidents before planned
      if (a.isPlanned !== b.isPlanned) return a.isPlanned ? 1 : -1
      // Then by severity
      const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (rankDiff !== 0) return rankDiff
      // Then by start time (soonest first for planned, most recent for active)
      const aTime = a.startsAt?.getTime() ?? a.createdAt.getTime()
      const bTime = b.startsAt?.getTime() ?? b.createdAt.getTime()
      return a.isPlanned ? aTime - bTime : bTime - aTime
    })

  // Build feed news with source info
  const latestNews: FeedNewsPost[] = news.map((post) => {
    const sourceInfo = tenantInfo.get(post.sourceTenantId)
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      heroImageUrl: post.heroImageUrl,
      bodyMarkdown: post.bodyMarkdown,
      publishedAt: post.publishedAt,
      sourceTenantId: post.sourceTenantId,
      sourceTenantName: sourceInfo?.name ?? 'Unknown',
      sourceTenantType: sourceInfo?.type ?? 'provider'
    }
  })

  return { activeIncidents, latestNews, sources }
}

/**
 * Fetch active and planned incidents from source tenants.
 * Includes:
 * - Active incidents with no startsAt or startsAt <= now
 * - Planned incidents with startsAt within the next N days
 */
async function fetchActiveIncidents(sourceIds: string[], now: Date, plannedDaysAhead: number) {
  const db = getDb()

  // Calculate the lookahead window for planned incidents
  const plannedWindow = new Date(now.getTime() + plannedDaysAhead * 24 * 60 * 60 * 1000)

  return db
    .select({
      id: tenantIncidents.id,
      title: tenantIncidents.title,
      bodyMarkdown: tenantIncidents.bodyMarkdown,
      severity: tenantIncidents.severity,
      status: tenantIncidents.status,
      startsAt: tenantIncidents.startsAt,
      endsAt: tenantIncidents.endsAt,
      createdAt: tenantIncidents.createdAt,
      sourceTenantId: tenantIncidents.sourceTenantId
    })
    .from(tenantIncidents)
    .where(
      and(
        inArray(tenantIncidents.sourceTenantId, sourceIds),
        eq(tenantIncidents.status, 'active'),
        isNull(tenantIncidents.deletedAt),
        // Time window: 
        // - startsAt is null (immediate) OR startsAt <= now (active) OR startsAt <= plannedWindow (planned)
        or(
          isNull(tenantIncidents.startsAt),
          lte(tenantIncidents.startsAt, plannedWindow)
        ),
        // - endsAt is null (no end) OR endsAt > now (not yet ended)
        or(isNull(tenantIncidents.endsAt), gt(tenantIncidents.endsAt, now))
      )
    )
    .orderBy(desc(tenantIncidents.createdAt))
}

/**
 * Fetch latest published news from source tenants.
 */
async function fetchLatestNews(sourceIds: string[], now: Date, limit: number) {
  const db = getDb()

  return db
    .select({
      id: tenantNewsPosts.id,
      title: tenantNewsPosts.title,
      slug: tenantNewsPosts.slug,
      summary: tenantNewsPosts.summary,
      heroImageUrl: tenantNewsPosts.heroImageUrl,
      bodyMarkdown: tenantNewsPosts.bodyMarkdown,
      publishedAt: tenantNewsPosts.publishedAt,
      sourceTenantId: tenantNewsPosts.sourceTenantId
    })
    .from(tenantNewsPosts)
    .where(
      and(
        inArray(tenantNewsPosts.sourceTenantId, sourceIds),
        eq(tenantNewsPosts.status, 'published'),
        or(isNull(tenantNewsPosts.publishedAt), lte(tenantNewsPosts.publishedAt, now))
      )
    )
    .orderBy(desc(tenantNewsPosts.publishedAt))
    .limit(limit)
}

/**
 * Get IDs of incidents that are muted for the current scope.
 */
async function getMutedIncidentIds(opts: {
  incidentIds: string[]
  contextType: 'organization' | 'tenant'
  orgId?: string
  tenantId?: string
  now: Date
}): Promise<Set<string>> {
  if (opts.incidentIds.length === 0) return new Set()

  const db = getDb()
  const { incidentIds, contextType, orgId, tenantId, now } = opts

  let muteCondition

  if (contextType === 'organization' && orgId) {
    muteCondition = and(
      eq(tenantIncidentMutes.targetType, 'organization'),
      eq(tenantIncidentMutes.organizationId, orgId)
    )
  } else if (contextType === 'tenant' && tenantId) {
    muteCondition = and(
      eq(tenantIncidentMutes.targetType, 'tenant'),
      eq(tenantIncidentMutes.targetTenantId, tenantId)
    )
  } else {
    return new Set()
  }

  const mutes = await db
    .select({ incidentId: tenantIncidentMutes.incidentId })
    .from(tenantIncidentMutes)
    .where(
      and(
        inArray(tenantIncidentMutes.incidentId, incidentIds),
        muteCondition,
        // muteUntil is null (permanent) or muteUntil > now
        or(isNull(tenantIncidentMutes.muteUntil), gt(tenantIncidentMutes.muteUntil, now))
      )
    )

  return new Set(mutes.map((m) => m.incidentId))
}

