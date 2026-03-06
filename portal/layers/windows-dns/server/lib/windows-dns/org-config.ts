import { eq, and, inArray } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { getDb } from '~~/server/utils/db'
import {
  organizations,
  windowsDnsOrgConfig,
  windowsDnsAllowedZones,
  windowsDnsLastDiscovery,
  windowsDnsBlockedZones
} from '~~/server/database/schema'
import type {
  WindowsDnsOrgConfig,
  WindowsDnsAllowedZone,
  WindowsDnsBlockedZone,
  WindowsDnsLastDiscovery
} from './types'

/**
 * Get Windows DNS org config from database.
 * CoreID is derived from organizations.core_id (source of truth).
 */
export const getOrgConfig = async (orgId: string): Promise<WindowsDnsOrgConfig | null> => {
  const db = getDb()

  // Query config and join with organizations to get coreId
  const result = await db
    .select({
      config: windowsDnsOrgConfig,
      coreId: organizations.coreId
    })
    .from(windowsDnsOrgConfig)
    .innerJoin(organizations, eq(windowsDnsOrgConfig.organizationId, organizations.id))
    .where(eq(windowsDnsOrgConfig.organizationId, orgId))
    .limit(1)

  if (!result.length) {
    // No config exists - check if org exists and has coreId
    const orgResult = await db
      .select({ coreId: organizations.coreId })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (orgResult.length && orgResult[0]!.coreId) {
      // Org exists with coreId but no config yet - return minimal config
      return {
        coreId: orgResult[0]!.coreId,
        instanceId: null,
        windowsDnsAccountId: null,
        enabledAt: null,
        lastValidatedAt: null,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null
      }
    }
    return null
  }

  const row = result[0]!
  return {
    instanceId: row.config.instanceId,
    windowsDnsAccountId: row.config.windowsDnsAccountId,
    coreId: row.coreId, // Derived from organizations table
    enabledAt: row.config.enabledAt,
    lastValidatedAt: row.config.lastValidatedAt,
    lastSyncAt: row.config.lastSyncAt,
    lastSyncStatus: row.config.lastSyncStatus,
    lastSyncError: row.config.lastSyncError
  }
}

/**
 * Get CoreID for an organization (from organizations.core_id).
 * This is the source of truth for COREID.
 */
export const getOrgCoreId = async (orgId: string): Promise<string | null> => {
  const db = getDb()
  const result = await db
    .select({ coreId: organizations.coreId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  return result.length ? result[0]!.coreId : null
}

/**
 * Clear the Windows DNS account ID for an organization.
 * This is used for self-healing when the account no longer exists in the layer.
 */
export const clearAccountId = async (orgId: string): Promise<void> => {
  const db = getDb()
  await db
    .update(windowsDnsOrgConfig)
    .set({
      windowsDnsAccountId: null,
      updatedAt: new Date()
    })
    .where(eq(windowsDnsOrgConfig.organizationId, orgId))
  
  console.log(`[windows-dns] Cleared accountId for org ${orgId}`)
}

/**
 * Save Windows DNS org config to database.
 * Note: coreId is NOT saved here - it's derived from organizations.core_id.
 */
export const saveOrgConfig = async (
  orgId: string,
  config: Partial<Omit<WindowsDnsOrgConfig, 'coreId'>>
): Promise<WindowsDnsOrgConfig> => {
  const db = getDb()
  const now = new Date()

  // Check if config exists
  const existing = await db
    .select()
    .from(windowsDnsOrgConfig)
    .where(eq(windowsDnsOrgConfig.organizationId, orgId))
    .limit(1)

  if (existing.length) {
    // Update existing config
    await db
      .update(windowsDnsOrgConfig)
      .set({
        instanceId: config.instanceId !== undefined ? config.instanceId : undefined,
        windowsDnsAccountId: config.windowsDnsAccountId !== undefined ? config.windowsDnsAccountId : undefined,
        enabledAt: config.enabledAt !== undefined ? config.enabledAt : undefined,
        lastValidatedAt: config.lastValidatedAt !== undefined ? config.lastValidatedAt : undefined,
        lastSyncAt: config.lastSyncAt !== undefined ? config.lastSyncAt : undefined,
        lastSyncStatus: config.lastSyncStatus !== undefined ? config.lastSyncStatus : undefined,
        lastSyncError: config.lastSyncError !== undefined ? config.lastSyncError : undefined,
        updatedAt: now
      })
      .where(eq(windowsDnsOrgConfig.organizationId, orgId))
  } else {
    // Insert new config
    await db.insert(windowsDnsOrgConfig).values({
      id: createId(),
      organizationId: orgId,
      instanceId: config.instanceId ?? null,
      windowsDnsAccountId: config.windowsDnsAccountId ?? null,
      enabledAt: config.enabledAt ?? now,
      lastValidatedAt: config.lastValidatedAt ?? null,
      lastSyncAt: config.lastSyncAt ?? null,
      lastSyncStatus: config.lastSyncStatus ?? null,
      lastSyncError: config.lastSyncError ?? null,
      createdAt: now,
      updatedAt: now
    })
  }

  // Return the full config with coreId
  const result = await getOrgConfig(orgId)
  return result!
}

/**
 * Update Windows DNS account ID after ensure operation
 */
export const setWindowsDnsAccountId = async (orgId: string, accountId: string): Promise<void> => {
  await saveOrgConfig(orgId, { windowsDnsAccountId: accountId })
}

/**
 * Delete Windows DNS org config
 */
export const deleteOrgConfig = async (orgId: string): Promise<void> => {
  const db = getDb()
  await db.delete(windowsDnsOrgConfig).where(eq(windowsDnsOrgConfig.organizationId, orgId))
}

/**
 * Delete all Windows DNS data for an organization.
 * This should be called before deleting an organization to avoid foreign key constraint errors.
 */
export const deleteAllWindowsDnsData = async (orgId: string): Promise<void> => {
  const db = getDb()
  
  // Delete in order to respect foreign key constraints
  // 1. Delete allowed zones (no dependencies)
  await db.delete(windowsDnsAllowedZones).where(eq(windowsDnsAllowedZones.organizationId, orgId))
  
  // 2. Delete blocked zones (no dependencies)
  await db.delete(windowsDnsBlockedZones).where(eq(windowsDnsBlockedZones.organizationId, orgId))
  
  // 3. Delete last discovery (no dependencies)
  await db.delete(windowsDnsLastDiscovery).where(eq(windowsDnsLastDiscovery.organizationId, orgId))
  
  // 4. Delete org config (no dependencies)
  await db.delete(windowsDnsOrgConfig).where(eq(windowsDnsOrgConfig.organizationId, orgId))
  
  // Note: We don't delete the account in WindowsDNS-layer here because:
  // - The account is in a separate database (WindowsDNS-dev)
  // - The account may be referenced by audit logs, tokens, etc.
  // - The account can be cleaned up separately if needed
}

/**
 * Get masked org config for display (no sensitive data)
 */
export const getMaskedOrgConfig = async (orgId: string) => {
  const config = await getOrgConfig(orgId)
  if (!config) return null

  return {
    instanceId: config.instanceId,
    windowsDnsAccountId: config.windowsDnsAccountId,
    coreId: config.coreId,
    enabledAt: config.enabledAt,
    lastValidatedAt: config.lastValidatedAt,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus
    // Note: No sensitive data is stored in org-config for Windows DNS
    // LayerToken (WINDOWS_DNS_LAYER_TOKEN) is server-only env var
    // API URL (WINDOWS_DNS_API_URL) is server-only env var
  }
}

// ============================================================================
// Allowed Zones Management
// ============================================================================

/**
 * Get all allowed zone IDs for an organization.
 */
export const getAllowedZoneIds = async (orgId: string): Promise<string[]> => {
  const db = getDb()
  const result = await db
    .select({ zoneId: windowsDnsAllowedZones.zoneId })
    .from(windowsDnsAllowedZones)
    .where(eq(windowsDnsAllowedZones.organizationId, orgId))

  return result.map(r => r.zoneId)
}

/**
 * Get all allowed zones for an organization with full details.
 */
export const getAllowedZones = async (orgId: string): Promise<WindowsDnsAllowedZone[]> => {
  const db = getDb()
  const result = await db
    .select()
    .from(windowsDnsAllowedZones)
    .where(eq(windowsDnsAllowedZones.organizationId, orgId))

  return result.map(r => ({
    id: r.id,
    organizationId: r.organizationId,
    zoneId: r.zoneId,
    zoneName: r.zoneName,
    source: r.source as 'autodiscover' | 'manual',
    createdAt: r.createdAt
  }))
}

/**
 * Add zones to the allowed list for an organization.
 * Idempotent: existing zones are ignored.
 */
export const addAllowedZones = async (
  orgId: string,
  zones: Array<{ zoneId: string; zoneName?: string; source?: 'autodiscover' | 'manual' }>
): Promise<void> => {
  const db = getDb()
  const now = new Date()

  // Get existing zone IDs
  const existing = await getAllowedZoneIds(orgId)
  const existingSet = new Set(existing)

  // Filter out zones that already exist
  const newZones = zones.filter(z => !existingSet.has(z.zoneId))

  if (newZones.length === 0) return

  // Insert new zones
  await db.insert(windowsDnsAllowedZones).values(
    newZones.map(z => ({
      id: createId(),
      organizationId: orgId,
      zoneId: z.zoneId,
      zoneName: z.zoneName ?? null,
      source: z.source ?? 'autodiscover',
      createdAt: now,
      updatedAt: now
    }))
  )
}

/**
 * Remove zones from the allowed list for an organization.
 */
export const removeAllowedZones = async (orgId: string, zoneIds: string[]): Promise<void> => {
  if (zoneIds.length === 0) return

  const db = getDb()
  await db
    .delete(windowsDnsAllowedZones)
    .where(
      and(
        eq(windowsDnsAllowedZones.organizationId, orgId),
        inArray(windowsDnsAllowedZones.zoneId, zoneIds)
      )
    )
}

/**
 * Replace all allowed zones for an organization (full sync).
 */
export const replaceAllowedZones = async (
  orgId: string,
  zones: Array<{ zoneId: string; zoneName?: string; source?: 'autodiscover' | 'manual' }>
): Promise<void> => {
  const db = getDb()
  const now = new Date()

  // Delete all existing zones for this org
  await db.delete(windowsDnsAllowedZones).where(eq(windowsDnsAllowedZones.organizationId, orgId))

  if (zones.length === 0) return

  // Insert new zones
  await db.insert(windowsDnsAllowedZones).values(
    zones.map(z => ({
      id: createId(),
      organizationId: orgId,
      zoneId: z.zoneId,
      zoneName: z.zoneName ?? null,
      source: z.source ?? 'autodiscover',
      createdAt: now,
      updatedAt: now
    }))
  )
}

// ============================================================================
// Last Discovery Management
// ============================================================================

/**
 * Save the last discovery result for an organization.
 */
export const saveLastDiscovery = async (
  orgId: string,
  zoneIds: string[],
  coreIdSnapshot?: string
): Promise<void> => {
  const db = getDb()
  const now = new Date()

  // Check if discovery record exists
  const existing = await db
    .select()
    .from(windowsDnsLastDiscovery)
    .where(eq(windowsDnsLastDiscovery.organizationId, orgId))
    .limit(1)

  const zoneIdsJson = JSON.stringify(zoneIds)

  if (existing.length) {
    await db
      .update(windowsDnsLastDiscovery)
      .set({
        discoveredAt: now,
        zoneIdsJson,
        coreIdSnapshot: coreIdSnapshot ?? null,
        updatedAt: now
      })
      .where(eq(windowsDnsLastDiscovery.organizationId, orgId))
  } else {
    await db.insert(windowsDnsLastDiscovery).values({
      id: createId(),
      organizationId: orgId,
      discoveredAt: now,
      zoneIdsJson,
      coreIdSnapshot: coreIdSnapshot ?? null,
      createdAt: now,
      updatedAt: now
    })
  }
}

/**
 * Get the last discovery result for an organization.
 */
export const getLastDiscovery = async (orgId: string): Promise<WindowsDnsLastDiscovery | null> => {
  const db = getDb()
  const result = await db
    .select()
    .from(windowsDnsLastDiscovery)
    .where(eq(windowsDnsLastDiscovery.organizationId, orgId))
    .limit(1)

  if (!result.length) return null

  const row = result[0]!
  return {
    organizationId: row.organizationId,
    discoveredAt: row.discoveredAt,
    zoneIds: JSON.parse(row.zoneIdsJson) as string[],
    coreIdSnapshot: row.coreIdSnapshot
  }
}

/**
 * Validate that the provided zone IDs match the last discovery result.
 * Returns true if all zoneIds were in the last discovery, false otherwise.
 */
export const validateZonesAgainstLastDiscovery = async (
  orgId: string,
  zoneIds: string[]
): Promise<{ valid: boolean; invalidZoneIds: string[] }> => {
  const lastDiscovery = await getLastDiscovery(orgId)

  if (!lastDiscovery) {
    return { valid: false, invalidZoneIds: zoneIds }
  }

  const discoveredSet = new Set(lastDiscovery.zoneIds)
  const invalidZoneIds = zoneIds.filter(id => !discoveredSet.has(id))

  return {
    valid: invalidZoneIds.length === 0,
    invalidZoneIds
  }
}

// ============================================================================
// Blocked Zones Management
// ============================================================================

/**
 * Get all blocked zone IDs for an organization.
 */
export const getBlockedZoneIds = async (orgId: string): Promise<string[]> => {
  const db = getDb()
  const result = await db
    .select({ zoneId: windowsDnsBlockedZones.zoneId })
    .from(windowsDnsBlockedZones)
    .where(eq(windowsDnsBlockedZones.organizationId, orgId))

  return result.map(r => r.zoneId)
}

/**
 * Get all blocked zones for an organization with full details.
 */
export const getBlockedZones = async (orgId: string): Promise<WindowsDnsBlockedZone[]> => {
  const db = getDb()
  const result = await db
    .select()
    .from(windowsDnsBlockedZones)
    .where(eq(windowsDnsBlockedZones.organizationId, orgId))

  return result.map(r => ({
    id: r.id,
    organizationId: r.organizationId,
    zoneId: r.zoneId,
    zoneName: r.zoneName,
    source: r.source as 'manual',
    createdAt: r.createdAt
  }))
}

/**
 * Add zones to the blocked list for an organization.
 * Idempotent: existing zones are ignored.
 */
export const addBlockedZones = async (
  orgId: string,
  zones: Array<{ zoneId: string; zoneName?: string }>
): Promise<void> => {
  const db = getDb()
  const now = new Date()

  // Get existing blocked zone IDs
  const existing = await getBlockedZoneIds(orgId)
  const existingSet = new Set(existing)

  // Filter out zones that already exist
  const newZones = zones.filter(z => !existingSet.has(z.zoneId))

  if (newZones.length === 0) return

  // Insert new blocked zones
  await db.insert(windowsDnsBlockedZones).values(
    newZones.map(z => ({
      id: createId(),
      organizationId: orgId,
      zoneId: z.zoneId,
      zoneName: z.zoneName ?? null,
      source: 'manual' as const,
      createdAt: now,
      updatedAt: now
    }))
  )
}

/**
 * Remove zones from the blocked list for an organization.
 */
export const removeBlockedZones = async (orgId: string, zoneIds: string[]): Promise<void> => {
  if (zoneIds.length === 0) return

  const db = getDb()
  await db
    .delete(windowsDnsBlockedZones)
    .where(
      and(
        eq(windowsDnsBlockedZones.organizationId, orgId),
        inArray(windowsDnsBlockedZones.zoneId, zoneIds)
      )
    )
}
