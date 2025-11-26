import {
  decryptConfig,
  encryptConfig,
  type EmailBranding,
  type EmailProviderProfile,
  type ProviderSecrets
} from '@coreit/email-kit'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import crypto from 'node:crypto'
import { emailProviderProfiles, organizations, tenants, distributorProviders } from '~/server/database/schema'
import { getDb } from './db'
import type { AdminEmailProviderSummary } from '~/types/admin'

const GLOBAL_TARGET_KEY = 'global'

type ProviderRecord = typeof emailProviderProfiles.$inferSelect

let devFallbackKey: string | null = null

const getDevFallbackKey = () => {
  if (!devFallbackKey) {
    devFallbackKey = crypto.createHash('sha256').update(process.cwd()).digest('hex')
    console.warn(
      '[email-provider] EMAIL_CRYPTO_KEY saknas – använder en temporär utvecklingsnyckel. Sätt EMAIL_CRYPTO_KEY i .env innan produktion.'
    )
  }
  return devFallbackKey
}

const ensureCryptoKey = () => {
  const key = process.env.EMAIL_CRYPTO_KEY
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      return getDevFallbackKey()
    }
    throw new Error('EMAIL_CRYPTO_KEY saknas.')
  }
  return key
}

const parseBranding = (value?: string | null): EmailBranding | null => {
  if (!value) return null
  try {
    return JSON.parse(value) as EmailBranding
  } catch {
    return null
  }
}

const serializeBranding = (value?: EmailBranding | null) => {
  if (!value) return null
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

export type EmailProviderSummary = AdminEmailProviderSummary

const buildSettings = (profile?: EmailProviderProfile | null) => {
  if (!profile) return undefined
  if (profile.type === 'smtp') {
    return {
      type: 'smtp' as const,
      host: profile.config.host,
      port: profile.config.port,
      secure: profile.config.secure ?? profile.config.port === 465,
      ignoreTls: profile.config.ignoreTls,
      authUser: profile.config.auth?.user ?? null
    }
  }
  return {
    type: 'graph' as const,
    tenantId: profile.config.tenantId,
    clientId: profile.config.clientId,
    scope: profile.config.scope,
    endpoint: profile.config.endpoint,
    senderUserId: profile.config.senderUserId
  }
}

const toSummary = (record: ProviderRecord, profile?: EmailProviderProfile | null): EmailProviderSummary => ({
  targetType: (record.targetType as 'global' | 'provider' | 'distributor' | 'organization') ?? 'organization',
  organisationId: record.organizationId ?? undefined,
  tenantId: record.tenantId ?? undefined,
  providerType: record.providerType as 'smtp' | 'graph',
  fromEmail: record.fromEmail ?? undefined,
  fromName: record.fromName ?? undefined,
  replyToEmail: record.replyToEmail ?? undefined,
  branding: parseBranding(record.brandingConfig),
  isActive: Boolean(record.isActive),
  hasConfig: Boolean(record.encryptedConfig),
  lastTestedAt: record.lastTestedAt ?? undefined,
  lastTestStatus: record.lastTestStatus ?? undefined,
  lastTestError: record.lastTestError ?? undefined,
  settings: buildSettings(profile)
})

const mapToProfile = (record: ProviderRecord, cryptoKey: string): EmailProviderProfile | null => {
  if (!record.fromEmail || !record.encryptedConfig || !record.encryptionIv || !record.encryptionAuthTag) {
    return null
  }
  try {
    const payload = {
      cipherText: record.encryptedConfig,
      iv: record.encryptionIv,
      authTag: record.encryptionAuthTag
    }
    const secrets = decryptConfig<ProviderSecrets>(payload, cryptoKey)
    return {
      ...secrets,
      fromEmail: record.fromEmail,
      fromName: record.fromName ?? undefined,
      replyToEmail: record.replyToEmail ?? undefined,
      branding: parseBranding(record.brandingConfig) ?? undefined
    }
  } catch (error) {
    console.error('[email-provider] Kunde inte dekryptera konfiguration', error)
    return null
  }
}

const fetchByTargetKey = async (targetKey: string) => {
  const db = getDb()
  const [record] = await db
    .select()
    .from(emailProviderProfiles)
    .where(eq(emailProviderProfiles.targetKey, targetKey))
    .limit(1)
  return record ?? null
}

const tryDecryptProfile = (record: ProviderRecord): EmailProviderProfile | null => {
  try {
    const key = ensureCryptoKey()
    return mapToProfile(record, key)
  } catch (error) {
    if (error instanceof Error && error.message.includes('EMAIL_CRYPTO_KEY')) {
      console.warn('[email-provider] EMAIL_CRYPTO_KEY saknas – kan inte läsa krypterad konfiguration.')
    } else {
      console.warn('[email-provider] Kunde inte dekryptera konfigurationen.', error)
    }
    return null
  }
}

const baseSummary = (targetType: 'global' | 'provider' | 'distributor' | 'organization', organisationId?: string | null, tenantId?: string | null) => ({
  targetType,
  organisationId: organisationId ?? null,
  tenantId: tenantId ?? null,
  isActive: false,
  hasConfig: false
})

export const getGlobalEmailProviderSummary = async () => {
  const record = await fetchByTargetKey(GLOBAL_TARGET_KEY)
  if (!record) {
    return baseSummary('global')
  }
  const profile = tryDecryptProfile(record)
  return toSummary(record, profile)
}

export const getProviderTenantEmailProviderSummary = async (tenantId: string) => {
  const record = await fetchByTargetKey(tenantId)
  if (!record) {
    return baseSummary('provider', null, tenantId)
  }
  const profile = tryDecryptProfile(record)
  return toSummary(record, profile)
}

export const getDistributorTenantEmailProviderSummary = async (tenantId: string) => {
  const record = await fetchByTargetKey(tenantId)
  if (!record) {
    return baseSummary('distributor', null, tenantId)
  }
  const profile = tryDecryptProfile(record)
  return toSummary(record, profile)
}

export const getOrganisationEmailProviderSummary = async (organisationId: string) => {
  const record = await fetchByTargetKey(organisationId)
  if (!record) {
    return baseSummary('organization', organisationId)
  }
  const profile = tryDecryptProfile(record)
  return toSummary(record, profile)
}

export interface SaveEmailProviderInput {
  fromEmail: string
  fromName?: string
  replyToEmail?: string
  branding?: EmailBranding | null
  isActive: boolean
  provider: ProviderSecrets
}

const upsertProvider = async (
  targetKey: string,
  targetType: 'global' | 'provider' | 'distributor' | 'organization',
  organisationId: string | null,
  tenantId: string | null,
  payload: SaveEmailProviderInput
) => {
  const cryptoKey = ensureCryptoKey()
  const encrypted = encryptConfig(payload.provider, cryptoKey)
  const db = getDb()
  await db
    .insert(emailProviderProfiles)
    .values({
      targetKey,
      targetType,
      organizationId: organisationId,
      tenantId: tenantId,
      providerType: payload.provider.type,
      isActive: payload.isActive,
      fromEmail: payload.fromEmail,
      fromName: payload.fromName ?? null,
      replyToEmail: payload.replyToEmail ?? null,
      brandingConfig: serializeBranding(payload.branding),
      encryptedConfig: encrypted.cipherText,
      encryptionIv: encrypted.iv,
      encryptionAuthTag: encrypted.authTag
    })
    .onConflictDoUpdate({
      target: emailProviderProfiles.targetKey,
      set: {
        targetType,
        organizationId: organisationId,
        tenantId: tenantId,
        providerType: payload.provider.type,
        isActive: payload.isActive,
        fromEmail: payload.fromEmail,
        fromName: payload.fromName ?? null,
        replyToEmail: payload.replyToEmail ?? null,
        brandingConfig: serializeBranding(payload.branding),
        encryptedConfig: encrypted.cipherText,
        encryptionIv: encrypted.iv,
        encryptionAuthTag: encrypted.authTag,
        configVersion: sql`${emailProviderProfiles.configVersion} + 1`,
        updatedAt: sql`(strftime('%s','now') * 1000)`
      }
    })
}

export const saveGlobalEmailProvider = async (payload: SaveEmailProviderInput) => {
  await upsertProvider(GLOBAL_TARGET_KEY, 'global', null, null, payload)
  return getGlobalEmailProviderSummary()
}

export const saveProviderTenantEmailProvider = async (
  tenantId: string,
  payload: SaveEmailProviderInput
) => {
  await upsertProvider(tenantId, 'provider', null, tenantId, payload)
  return getProviderTenantEmailProviderSummary(tenantId)
}

export const saveDistributorTenantEmailProvider = async (
  tenantId: string,
  payload: SaveEmailProviderInput
) => {
  await upsertProvider(tenantId, 'distributor', null, tenantId, payload)
  return getDistributorTenantEmailProviderSummary(tenantId)
}

export const saveOrganisationEmailProvider = async (
  organisationId: string,
  payload: SaveEmailProviderInput
) => {
  await upsertProvider(organisationId, 'organization', organisationId, null, payload)
  return getOrganisationEmailProviderSummary(organisationId)
}

/**
 * Get tenant hierarchy for an organization: [distributor, provider, organization]
 * New structure: Organization -> Provider -> Distributor (via junction table)
 * Returns empty array if organization not found
 */
const getTenantHierarchy = async (organisationId: string): Promise<Array<{ id: string; type: 'organization' | 'distributor' | 'provider' }>> => {
  const db = getDb()
  const [org] = await db
    .select({ tenantId: organizations.tenantId })
    .from(organizations)
    .where(eq(organizations.id, organisationId))
  
  if (!org?.tenantId) {
    return []
  }

  const hierarchy: Array<{ id: string; type: 'organization' | 'distributor' | 'provider' }> = []
  
  // Add organization first
  hierarchy.push({ id: organisationId, type: 'organization' })
  
  // Get provider (organization's tenantId should point to a provider)
  const [provider] = await db
    .select({ id: tenants.id, type: tenants.type })
    .from(tenants)
    .where(eq(tenants.id, org.tenantId))
  
  if (provider && provider.type === 'provider') {
    hierarchy.push({
      id: provider.id,
      type: 'provider'
    })
    
    // Get distributors linked to this provider via junction table
    const distributorLinks = await db
      .select({ distributorId: distributorProviders.distributorId })
      .from(distributorProviders)
      .where(eq(distributorProviders.providerId, provider.id))
      .limit(1) // Take first distributor (for hierarchy purposes)
    
    if (distributorLinks.length > 0) {
      const [distributor] = await db
        .select({ id: tenants.id, type: tenants.type })
        .from(tenants)
        .where(eq(tenants.id, distributorLinks[0].distributorId))
      
      if (distributor && distributor.type === 'distributor') {
        hierarchy.push({
          id: distributor.id,
          type: 'distributor'
        })
      }
    }
  }
  
  return hierarchy.reverse() // Reverse to get [distributor, provider, organization]
}

export const getEffectiveEmailProviderProfile = async (organisationId?: string | null) => {
  const cryptoKey = ensureCryptoKey()
  
  if (!organisationId) {
    // No organization - use global (which is inherited by providers)
    const globalRecord = await fetchByTargetKey(GLOBAL_TARGET_KEY)
    if (globalRecord && globalRecord.isActive) {
      return mapToProfile(globalRecord, cryptoKey)
    }
    return null
  }

  // Follow hierarchy: organization -> provider -> distributor -> global
  const hierarchy = await getTenantHierarchy(organisationId)
  
  // Check organization first
  const orgRecord = await fetchByTargetKey(organisationId)
  if (orgRecord && orgRecord.isActive && orgRecord.targetType === 'organization') {
    const profile = mapToProfile(orgRecord, cryptoKey)
    if (profile) {
      return profile
    }
  }
  
  // Check provider (if exists in hierarchy) - providers are now directly above organizations
  const provider = hierarchy.find(t => t.type === 'provider')
  if (provider) {
    const providerRecord = await fetchByTargetKey(provider.id)
    if (providerRecord && providerRecord.isActive && providerRecord.targetType === 'provider') {
      const profile = mapToProfile(providerRecord, cryptoKey)
      if (profile) {
        return profile
      }
    }
  }
  
  // Check distributor (if exists in hierarchy) - distributors are now above providers
  const distributor = hierarchy.find(t => t.type === 'distributor')
  if (distributor) {
    const distributorRecord = await fetchByTargetKey(distributor.id)
    if (distributorRecord && distributorRecord.isActive && distributorRecord.targetType === 'distributor') {
      const profile = mapToProfile(distributorRecord, cryptoKey)
      if (profile) {
        return profile
      }
    }
  }
  
  // Fallback to global (which is inherited by providers)
  const globalRecord = await fetchByTargetKey(GLOBAL_TARGET_KEY)
  if (globalRecord && globalRecord.isActive) {
    return mapToProfile(globalRecord, cryptoKey)
  }
  
  return null
}

export const getGlobalEmailProviderProfile = async () => {
  const cryptoKey = ensureCryptoKey()
  const record = await fetchByTargetKey(GLOBAL_TARGET_KEY)
  if (record && record.isActive) {
    return mapToProfile(record, cryptoKey)
  }
  return null
}

export const getProviderTenantEmailProviderProfile = async (tenantId: string) => {
  const cryptoKey = ensureCryptoKey()
  const record = await fetchByTargetKey(tenantId)
  if (record) {
    return mapToProfile(record, cryptoKey)
  }
  return null
}

export const getDistributorTenantEmailProviderProfile = async (tenantId: string) => {
  const cryptoKey = ensureCryptoKey()
  const record = await fetchByTargetKey(tenantId)
  if (record) {
    return mapToProfile(record, cryptoKey)
  }
  return null
}

export const getOrganisationEmailProviderProfile = async (organisationId: string) => {
  const cryptoKey = ensureCryptoKey()
  const record = await fetchByTargetKey(organisationId)
  if (record) {
    return mapToProfile(record, cryptoKey)
  }
  return null
}

export const recordTestResult = async (
  targetKey: string,
  status: 'success' | 'failure',
  errorMessage?: string
) => {
  const db = getDb()
  await db
    .update(emailProviderProfiles)
    .set({
      lastTestedAt: new Date(),
      lastTestStatus: status,
      lastTestError: errorMessage ?? null
    })
    .where(eq(emailProviderProfiles.targetKey, targetKey))
}

