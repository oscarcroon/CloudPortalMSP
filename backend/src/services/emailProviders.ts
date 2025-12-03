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
import { db } from '../db/client.js'
import { emailProviderProfilesTable } from '../db/schema.js'

const GLOBAL_TARGET_KEY = 'global'

type ProviderRecord = typeof emailProviderProfilesTable.$inferSelect

let devFallbackKey: string | null = null

const getDevFallbackKey = () => {
  if (!devFallbackKey) {
    devFallbackKey = crypto.createHash('sha256').update(process.cwd()).digest('hex')
    console.warn(
      '[email-provider] EMAIL_CRYPTO_KEY saknas – använder en temporär utvecklingsnyckel. Sätt EMAIL_CRYPTO_KEY i miljön innan produktion.'
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
    throw new Error('EMAIL_CRYPTO_KEY is not configured.')
  }
  return key
}

const parseBranding = (raw?: string | null): EmailBranding | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as EmailBranding
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

export type EmailProviderSettings =
  | {
      type: 'smtp'
      host: string
      port: number
      secure: boolean
      ignoreTls?: boolean
      authUser?: string | null
    }
  | {
      type: 'graph'
      tenantId: string
      clientId: string
      scope?: string
      endpoint?: string
      senderUserId?: string
    }

export interface EmailProviderSummary {
  targetType: 'global' | 'organization'
  organisationId?: string | null
  providerType?: 'smtp' | 'graph'
  fromEmail?: string
  fromName?: string | null
  replyToEmail?: string | null
  branding?: EmailBranding | null
  isActive: boolean
  hasConfig: boolean
  lastTestedAt?: string
  lastTestStatus?: string | null
  lastTestError?: string | null
  settings?: EmailProviderSettings
}

const buildSettings = (profile?: EmailProviderProfile | null): EmailProviderSettings | undefined => {
  if (!profile) return undefined
  if (profile.type === 'smtp') {
    return {
      type: 'smtp',
      host: profile.config.host,
      port: profile.config.port,
      secure: profile.config.secure ?? profile.config.port === 465,
      ignoreTls: profile.config.ignoreTls,
      authUser: profile.config.auth?.user ?? null
    }
  }
  return {
    type: 'graph',
    tenantId: profile.config.tenantId,
    clientId: profile.config.clientId,
    scope: profile.config.scope,
    endpoint: profile.config.endpoint,
    senderUserId: profile.config.senderUserId
  }
}

const toSummary = (record: ProviderRecord, profile?: EmailProviderProfile | null): EmailProviderSummary => ({
  targetType: (record.targetType as 'global' | 'organization') ?? 'organization',
  organisationId: record.organizationId,
  providerType: record.providerType as 'smtp' | 'graph',
  fromEmail: record.fromEmail ?? undefined,
  fromName: record.fromName,
  replyToEmail: record.replyToEmail,
  branding: parseBranding(record.brandingConfig),
  isActive: Boolean(record.isActive),
  hasConfig: Boolean(record.encryptedConfig),
  lastTestedAt: record.lastTestedAt ? new Date(record.lastTestedAt).toISOString() : undefined,
  lastTestStatus: record.lastTestStatus,
  lastTestError: record.lastTestError,
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
    // Only log in development if using fallback key (expected behavior)
    const isDevFallback = process.env.NODE_ENV !== 'production' && !process.env.EMAIL_CRYPTO_KEY
    if (!isDevFallback) {
      console.error('[email-provider] Failed to decrypt provider config', error)
    }
    return null
  }
}

const fetchByTargetKey = async (targetKey: string) => {
  return await db
    .select()
    .from(emailProviderProfilesTable)
    .where(eq(emailProviderProfilesTable.targetKey, targetKey))
    .limit(1)
    .then((rows) => rows[0] ?? null)
}

const tryDecryptProfile = (record: ProviderRecord): EmailProviderProfile | null => {
  try {
    const key = ensureCryptoKey()
    return mapToProfile(record, key)
  } catch (error) {
    // Only log warnings if not using dev fallback key
    const isDevFallback = process.env.NODE_ENV !== 'production' && !process.env.EMAIL_CRYPTO_KEY
    if (!isDevFallback) {
      if (error instanceof Error && error.message.includes('EMAIL_CRYPTO_KEY')) {
        console.warn('[email-provider] EMAIL_CRYPTO_KEY saknas – kan inte läsa krypterad konfiguration.')
      } else {
        console.warn('[email-provider] Kunde inte dekryptera konfigurationen.', error)
      }
    }
    return null
  }
}

const baseSummary = (targetType: 'global' | 'organization', organisationId?: string | null) => ({
  targetType,
  organisationId: organisationId ?? null,
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
  targetType: 'global' | 'organization',
  organisationId: string | null,
  payload: SaveEmailProviderInput
) => {
  const cryptoKey = ensureCryptoKey()
  const encrypted = encryptConfig(payload.provider, cryptoKey)
  await db
    .insert(emailProviderProfilesTable)
    .values({
      targetKey,
      targetType,
      organizationId: organisationId,
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
      target: emailProviderProfilesTable.targetKey,
      set: {
        targetType,
        organizationId: organisationId,
        providerType: payload.provider.type,
        isActive: payload.isActive,
        fromEmail: payload.fromEmail,
        fromName: payload.fromName ?? null,
        replyToEmail: payload.replyToEmail ?? null,
        brandingConfig: serializeBranding(payload.branding),
        encryptedConfig: encrypted.cipherText,
        encryptionIv: encrypted.iv,
        encryptionAuthTag: encrypted.authTag,
        configVersion: sql`${emailProviderProfilesTable.configVersion} + 1`,
        updatedAt: sql`(strftime('%s','now') * 1000)`
      }
    })
}

export const saveGlobalEmailProvider = async (payload: SaveEmailProviderInput) => {
  await upsertProvider(GLOBAL_TARGET_KEY, 'global', null, payload)
  return getGlobalEmailProviderSummary()
}

export const saveOrganisationEmailProvider = async (organisationId: string, payload: SaveEmailProviderInput) => {
  await upsertProvider(organisationId, 'organization', organisationId, payload)
  return getOrganisationEmailProviderSummary(organisationId)
}

export const getEffectiveEmailProviderProfile = async (organisationId?: string | null) => {
  const cryptoKey = ensureCryptoKey()
  if (organisationId) {
    const record = await fetchByTargetKey(organisationId)
    if (record && record.isActive) {
      const profile = mapToProfile(record, cryptoKey)
      if (profile) {
        return profile
      }
    }
  }
  const globalRecord = await fetchByTargetKey(GLOBAL_TARGET_KEY)
  if (globalRecord && globalRecord.isActive) {
    return mapToProfile(globalRecord, cryptoKey)
  }
  return null
}

export const getGlobalEmailProviderProfile = async () => {
  const cryptoKey = ensureCryptoKey()
  const record = await fetchByTargetKey(GLOBAL_TARGET_KEY)
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
  await db
    .update(emailProviderProfilesTable)
    .set({
      lastTestedAt: new Date(),
      lastTestStatus: status,
      lastTestError: errorMessage ?? null
    })
    .where(eq(emailProviderProfilesTable.targetKey, targetKey))
}

