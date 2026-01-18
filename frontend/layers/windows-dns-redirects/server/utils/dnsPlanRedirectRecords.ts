/**
 * DNS Plan & Apply utilities for Redirect-managed DNS records.
 *
 * This module handles:
 * - Building DNS plans (what records need to be created/updated)
 * - Detecting conflicts with existing DNS records
 * - Applying DNS changes idempotently
 * - Tracking managed records in the database
 */

import { eq, and } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { windowsDnsManagedRecords } from '~~/server/database/schema'
import { hostToZoneRecordName } from './normalizeHost'
import { createId } from '@paralleldrive/cuid2'

// Environment variable names
const ENV_PUBLIC_IPV4 = 'WINDOWS_DNS_REDIRECTS_PUBLIC_IPV4'
const ENV_PUBLIC_IPV4S = 'WINDOWS_DNS_REDIRECTS_PUBLIC_IPV4S'
const ENV_PUBLIC_IPV6 = 'WINDOWS_DNS_REDIRECTS_PUBLIC_IPV6'
const ENV_PUBLIC_IPV6S = 'WINDOWS_DNS_REDIRECTS_PUBLIC_IPV6S'
const ENV_PUBLIC_TTL = 'WINDOWS_DNS_REDIRECTS_PUBLIC_TTL'
const ENV_MANAGED_COMMENT = 'WINDOWS_DNS_REDIRECTS_MANAGED_COMMENT_TEXT'

const DEFAULT_TTL = 3600
const DEFAULT_MANAGED_COMMENT = '[redirects] managed'

export interface DnsRecordSpec {
  name: string
  type: 'A' | 'AAAA' | 'CNAME'
  content: string
  ttl: number
  comment?: string
}

export interface DnsRecord {
  id?: string
  name: string
  type: string
  content: string
  ttl?: number
  comment?: string | null
}

export interface DnsPlanEntry {
  action: 'create' | 'update' | 'delete' | 'noop'
  record: DnsRecordSpec
  existing?: DnsRecord
  reason?: string
}

export interface DnsPlanResult {
  isApex: boolean
  recordName: string
  entries: DnsPlanEntry[]
  hasConflicts: boolean
  conflicts: DnsPlanEntry[]
}

/**
 * Get the configured public IPv4 addresses for Traefik.
 */
export function getPublicIPv4s(): string[] {
  const list = process.env[ENV_PUBLIC_IPV4S]?.trim()
  if (list) {
    return list.split(',').map(ip => ip.trim()).filter(Boolean)
  }
  const single = process.env[ENV_PUBLIC_IPV4]?.trim()
  return single ? [single] : []
}

/**
 * Get the configured public IPv6 addresses for Traefik.
 */
export function getPublicIPv6s(): string[] {
  const list = process.env[ENV_PUBLIC_IPV6S]?.trim()
  if (list) {
    return list.split(',').map(ip => ip.trim()).filter(Boolean)
  }
  const single = process.env[ENV_PUBLIC_IPV6]?.trim()
  return single ? [single] : []
}

/**
 * Get the configured TTL for redirect DNS records.
 */
export function getPublicTTL(): number {
  const raw = process.env[ENV_PUBLIC_TTL]?.trim()
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL
}

/**
 * Get the managed comment text (used to mark records as redirect-managed).
 */
export function getManagedComment(): string {
  return process.env[ENV_MANAGED_COMMENT]?.trim() || DEFAULT_MANAGED_COMMENT
}

/**
 * Check if DNS integration is enabled (at least one public IP configured).
 */
export function isDnsIntegrationEnabled(): boolean {
  return getPublicIPv4s().length > 0 || getPublicIPv6s().length > 0
}

/**
 * Build the desired DNS records for a given host.
 *
 * - Apex (@): A record(s) pointing to configured IPv4(s), optionally AAAA for IPv6
 * - Subdomain: CNAME pointing to the zone apex
 */
export function buildDesiredRecords(host: string, zoneName: string): DnsRecordSpec[] {
  const recordName = hostToZoneRecordName(host, zoneName)
  const isApex = recordName === '@'
  const ttl = getPublicTTL()
  const comment = getManagedComment()
  const records: DnsRecordSpec[] = []

  if (isApex) {
    // Apex: A records for IPv4, AAAA for IPv6
    for (const ip of getPublicIPv4s()) {
      records.push({ name: '@', type: 'A', content: ip, ttl, comment })
    }
    for (const ip of getPublicIPv6s()) {
      records.push({ name: '@', type: 'AAAA', content: ip, ttl, comment })
    }
  } else {
    // Subdomain: CNAME to zone apex
    records.push({ name: recordName, type: 'CNAME', content: zoneName, ttl, comment })
  }

  return records
}

/**
 * Build a DNS plan comparing desired state with existing records.
 */
export function buildDnsPlan(
  host: string,
  zoneName: string,
  existingRecords: DnsRecord[]
): DnsPlanResult {
  const recordName = hostToZoneRecordName(host, zoneName)
  const isApex = recordName === '@'
  const desired = buildDesiredRecords(host, zoneName)

  // Filter existing records for this name
  const relevantTypes = new Set(['A', 'AAAA', 'CNAME'])
  const relevant = existingRecords.filter(r =>
    normalizeRecordName(r.name) === normalizeRecordName(recordName) &&
    relevantTypes.has(r.type?.toUpperCase())
  )

  const entries: DnsPlanEntry[] = []
  const conflicts: DnsPlanEntry[] = []

  // Check each desired record
  for (const want of desired) {
    const match = relevant.find(r =>
      r.type?.toUpperCase() === want.type &&
      normalizeContent(r.content) === normalizeContent(want.content)
    )

    if (match) {
      // Record already exists with correct content
      entries.push({ action: 'noop', record: want, existing: match, reason: 'Already correct' })
    } else {
      // Need to create this record
      entries.push({ action: 'create', record: want, reason: 'Missing desired record' })
    }
  }

  // Check for conflicting records that need removal
  for (const existing of relevant) {
    const isDesired = desired.some(d =>
      d.type === existing.type?.toUpperCase() &&
      normalizeContent(d.content) === normalizeContent(existing.content)
    )

    if (!isDesired) {
      // This record conflicts and needs to be removed
      const entry: DnsPlanEntry = {
        action: 'delete',
        record: {
          name: recordName,
          type: existing.type as 'A' | 'AAAA' | 'CNAME',
          content: existing.content,
          ttl: existing.ttl ?? getPublicTTL()
        },
        existing,
        reason: 'Conflicting record'
      }
      entries.push(entry)
      conflicts.push(entry)
    }
  }

  return {
    isApex,
    recordName,
    entries,
    hasConflicts: conflicts.length > 0,
    conflicts
  }
}

/**
 * Normalize record name for comparison (handle @ vs zone name).
 */
function normalizeRecordName(name: string): string {
  return (name || '@').trim().toLowerCase().replace(/\.$/, '')
}

/**
 * Normalize content for comparison.
 */
function normalizeContent(content: string): string {
  return (content || '').trim().toLowerCase().replace(/\.$/, '')
}

/**
 * Build a record key for the managed_records table.
 */
export function buildRecordKey(type: string, name: string): string {
  return `${type.toUpperCase()}|${normalizeRecordName(name)}`
}

/**
 * Track a DNS record as managed by redirects in the database.
 */
export async function trackManagedRecord(params: {
  zoneId: string
  recordKey: string
  managedBy: 'redirects' | 'redirects_shared'
  managedId?: string | null
  userId?: string
}): Promise<void> {
  const db = getDb()

  // Upsert: check if exists, then insert or update
  const [existing] = await db
    .select()
    .from(windowsDnsManagedRecords)
    .where(
      and(
        eq(windowsDnsManagedRecords.zoneId, params.zoneId),
        eq(windowsDnsManagedRecords.recordKey, params.recordKey),
        eq(windowsDnsManagedRecords.managedBy, params.managedBy)
      )
    )
    .limit(1)

  if (existing) {
    await db
      .update(windowsDnsManagedRecords)
      .set({
        managedId: params.managedId ?? null,
        lastAppliedByUserId: params.userId ?? null,
        lastAppliedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(windowsDnsManagedRecords.id, existing.id))
  } else {
    await db.insert(windowsDnsManagedRecords).values({
      id: createId(),
      zoneId: params.zoneId,
      recordKey: params.recordKey,
      managedBy: params.managedBy,
      managedId: params.managedId ?? null,
      lastAppliedByUserId: params.userId ?? null,
      lastAppliedAt: new Date()
    })
  }
}

/**
 * Remove managed record tracking when a redirect is deleted.
 */
export async function untrackManagedRecord(params: {
  zoneId: string
  recordKey: string
  managedBy: 'redirects' | 'redirects_shared'
  managedId?: string | null
}): Promise<void> {
  const db = getDb()

  await db
    .delete(windowsDnsManagedRecords)
    .where(
      and(
        eq(windowsDnsManagedRecords.zoneId, params.zoneId),
        eq(windowsDnsManagedRecords.recordKey, params.recordKey),
        eq(windowsDnsManagedRecords.managedBy, params.managedBy),
        params.managedId
          ? eq(windowsDnsManagedRecords.managedId, params.managedId)
          : undefined
      )
    )
}

/**
 * Check if a record is managed by redirects.
 */
export async function isRecordManagedByRedirects(
  zoneId: string,
  recordType: string,
  recordName: string
): Promise<boolean> {
  const db = getDb()
  const recordKey = buildRecordKey(recordType, recordName)

  const [existing] = await db
    .select({ id: windowsDnsManagedRecords.id })
    .from(windowsDnsManagedRecords)
    .where(
      and(
        eq(windowsDnsManagedRecords.zoneId, zoneId),
        eq(windowsDnsManagedRecords.recordKey, recordKey)
      )
    )
    .limit(1)

  return !!existing
}

/**
 * Get all managed records for a zone.
 */
export async function getManagedRecordsForZone(zoneId: string) {
  const db = getDb()

  return db
    .select()
    .from(windowsDnsManagedRecords)
    .where(eq(windowsDnsManagedRecords.zoneId, zoneId))
}
