import { eq, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import {
  cloudflareDnsOrgConfig,
  cloudflareDnsZonesCache
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { decryptSecret, encryptSecret, maskSecret } from './crypto'
import type { CloudflareOrgConfig } from './types'

export const getOrgConfig = async (orgId: string): Promise<CloudflareOrgConfig | null> => {
  const db = getDb()
  const [row] = await db
    .select()
    .from(cloudflareDnsOrgConfig)
    .where(eq(cloudflareDnsOrgConfig.organizationId, orgId))
    .limit(1)

  if (!row) return null

  const apiToken = decryptSecret({
    cipherText: row.encryptedApiToken,
    iv: row.encryptionIv,
    authTag: row.encryptionAuthTag
  })

  return {
    apiToken,
    accountId: row.accountId,
    lastValidatedAt: row.lastValidatedAt,
    lastSyncAt: row.lastSyncAt,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncError: row.lastSyncError
  }
}

export const getMaskedOrgConfig = async (orgId: string) => {
  const config = await getOrgConfig(orgId)
  if (!config) return null

  return {
    accountId: config.accountId,
    tokenMasked: maskSecret(config.apiToken),
    lastValidatedAt: config.lastValidatedAt,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    lastSyncError: config.lastSyncError
  }
}

export const saveOrgConfig = async (orgId: string, input: { apiToken: string; accountId?: string | null }) => {
  const encrypted = encryptSecret(input.apiToken)
  const db = getDb()
  const now = new Date()

  await db
    .insert(cloudflareDnsOrgConfig)
    .values({
      id: createId(),
      organizationId: orgId,
      encryptedApiToken: encrypted.cipherText,
      encryptionIv: encrypted.iv,
      encryptionAuthTag: encrypted.authTag,
      accountId: input.accountId ?? null,
      lastValidatedAt: now,
      createdAt: now,
      updatedAt: now
    })
    .onDuplicateKeyUpdate({
      set: {
        encryptedApiToken: encrypted.cipherText,
        encryptionIv: encrypted.iv,
        encryptionAuthTag: encrypted.authTag,
        accountId: input.accountId ?? null,
        lastValidatedAt: now,
        updatedAt: now
      }
    })

  return {
    accountId: input.accountId ?? null,
    tokenMasked: maskSecret(input.apiToken),
    lastValidatedAt: now
  }
}

export const updateValidationStatus = async (
  orgId: string,
  status: {
    lastValidatedAt?: Date | null
    lastSyncAt?: Date | null
    lastSyncStatus?: string | null
    lastSyncError?: string | null
  }
) => {
  const db = getDb()
  await db
    .update(cloudflareDnsOrgConfig)
    .set({
      lastValidatedAt: status.lastValidatedAt ?? sql`last_validated_at`,
      lastSyncAt: status.lastSyncAt ?? sql`last_sync_at`,
      lastSyncStatus: status.lastSyncStatus ?? null,
      lastSyncError: status.lastSyncError ?? null,
      updatedAt: new Date()
    })
    .where(eq(cloudflareDnsOrgConfig.organizationId, orgId))
}

export const clearZoneCacheForOrg = async (orgId: string) => {
  const db = getDb()
  await db.delete(cloudflareDnsZonesCache).where(eq(cloudflareDnsZonesCache.organizationId, orgId))
}

export const getZoneCache = async (
  orgId: string
): Promise<
  {
    zoneId: string
    name: string
    status: string | null
    plan: string | null
    recordCount: number | null
    lastSyncedAt: Date | null
  }[]
> => {
  const db = getDb()
  const rows = await db
    .select({
      zoneId: cloudflareDnsZonesCache.zoneId,
      name: cloudflareDnsZonesCache.name,
      status: cloudflareDnsZonesCache.status,
      plan: cloudflareDnsZonesCache.plan,
      recordCount: cloudflareDnsZonesCache.recordCount,
      lastSyncedAt: cloudflareDnsZonesCache.lastSyncedAt
    })
    .from(cloudflareDnsZonesCache)
    .where(eq(cloudflareDnsZonesCache.organizationId, orgId))

  return rows
}

export const upsertZoneCache = async (
  orgId: string,
  zones: {
    id: string
    name: string
    status?: string | null
    plan?: string | null
    recordCount?: number | null
    lastSyncedAt?: Date | null
  }[]
) => {
  if (!zones.length) return
  const db = getDb()
  const now = new Date()
  for (const zone of zones) {
    await db
      .insert(cloudflareDnsZonesCache)
      .values({
        id: createId(),
        organizationId: orgId,
        zoneId: zone.id,
        name: zone.name,
        status: zone.status ?? null,
        plan: zone.plan ?? null,
        recordCount: zone.recordCount ?? null,
        lastSyncedAt: zone.lastSyncedAt ?? now,
        createdAt: now,
        updatedAt: now
      })
      .onDuplicateKeyUpdate({
        set: {
          name: zone.name,
          status: zone.status ?? null,
          plan: zone.plan ?? null,
          recordCount: zone.recordCount ?? null,
          lastSyncedAt: zone.lastSyncedAt ?? now,
          updatedAt: now
        }
      })
  }
}

export const getZoneCacheSummary = async (orgId: string) => {
  const db = getDb()
  const rows = await db
    .select({
      zoneId: cloudflareDnsZonesCache.zoneId,
      lastSyncedAt: cloudflareDnsZonesCache.lastSyncedAt
    })
    .from(cloudflareDnsZonesCache)
    .where(eq(cloudflareDnsZonesCache.organizationId, orgId))

  const lastSyncAt = rows.reduce<Date | null>((acc, row) => {
    if (!row.lastSyncedAt) return acc
    if (!acc || row.lastSyncedAt > acc) return row.lastSyncedAt
    return acc
  }, null)

  return {
    zones: rows.length,
    lastSyncAt
  }
}

export const deleteOrgConfig = async (orgId: string) => {
  const db = getDb()
  // Delete org config
  await db.delete(cloudflareDnsOrgConfig).where(eq(cloudflareDnsOrgConfig.organizationId, orgId))
  // Clear zone cache
  await clearZoneCacheForOrg(orgId)
}


