import {
  decryptConfig,
  encryptConfig,
  type EmailProviderProfile,
  type ProviderSecrets
} from '@coreit/email-kit'
import { eq, sql } from 'drizzle-orm'
import crypto from 'node:crypto'
import { emailProviderProfiles, organizations, tenants, distributorProviders } from '~~/server/database/schema'
import { getDb } from './db'
import type { AdminEmailProviderSummary, EmailProviderChainEntry } from '~/types/admin'

const GLOBAL_TARGET_KEY = 'global'

type ProviderRecord = typeof emailProviderProfiles.$inferSelect
type HierarchyNode = {
  id: string
  type: 'organization' | 'provider' | 'distributor'
  name: string | null
}
type TargetDescriptor = HierarchyNode | { id: string; type: 'global'; name: string | null }

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
  subjectPrefix: record.subjectPrefix ?? null,
  supportContact: record.supportContact ?? null,
  emailDarkMode: Boolean(record.emailDarkMode),
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
      replyToEmail: record.replyToEmail ?? undefined
    }
  } catch (error) {
    // Only log in development if using fallback key (expected behavior)
    const isDevFallback = process.env.NODE_ENV !== 'production' && !process.env.EMAIL_CRYPTO_KEY
    if (!isDevFallback) {
      console.error('[email-provider] Kunde inte dekryptera konfiguration', error)
    }
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

const tryDecryptProfile = (record: ProviderRecord, cryptoKey?: string): EmailProviderProfile | null => {
  try {
    const key = cryptoKey ?? ensureCryptoKey()
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

const baseSummary = (targetType: 'global' | 'provider' | 'distributor' | 'organization', organisationId?: string | null, tenantId?: string | null) => ({
  targetType,
  organisationId: organisationId ?? null,
  tenantId: tenantId ?? null,
  subjectPrefix: null,
  supportContact: null,
  disclaimerMarkdown: null,
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
  subjectPrefix?: string | null
  supportContact?: string | null
  emailDarkMode?: boolean
  isActive: boolean
  provider: ProviderSecrets
}

const normalizeOptionalString = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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
      subjectPrefix: normalizeOptionalString(payload.subjectPrefix),
      supportContact: normalizeOptionalString(payload.supportContact),
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
        subjectPrefix: normalizeOptionalString(payload.subjectPrefix),
        supportContact: normalizeOptionalString(payload.supportContact),
        emailDarkMode: payload.emailDarkMode ?? false,
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

const getHierarchyForOrganization = async (organisationId: string): Promise<HierarchyNode[]> => {
  const db = getDb()
  const [org] = await db
    .select({
      id: organizations.id,
      tenantId: organizations.tenantId,
      name: organizations.name
    })
    .from(organizations)
    .where(eq(organizations.id, organisationId))
    .limit(1)

  if (!org) {
    return []
  }

  const hierarchy: HierarchyNode[] = [{ id: org.id, type: 'organization', name: org.name }]

  if (!org.tenantId) {
    return hierarchy
  }

  const tenant = await loadTenant(org.tenantId)
  if (tenant?.type === 'provider') {
    hierarchy.push({ id: tenant.id, type: 'provider', name: tenant.name })
    const distributor = await findDistributorForProvider(tenant.id)
    if (distributor) {
      hierarchy.push({ id: distributor.id, type: 'distributor', name: distributor.name })
    }
  } else if (tenant?.type === 'distributor') {
    hierarchy.push({ id: tenant.id, type: 'distributor', name: tenant.name })
  }

  return hierarchy
}

const getHierarchyForTenant = async (tenantId: string): Promise<HierarchyNode[]> => {
  const tenant = await loadTenant(tenantId)
  if (!tenant) {
    return []
  }

  if (tenant.type === 'provider') {
    const hierarchy: HierarchyNode[] = [{ id: tenant.id, type: 'provider', name: tenant.name }]
    const distributor = await findDistributorForProvider(tenant.id)
    if (distributor) {
      hierarchy.push({ id: distributor.id, type: 'distributor', name: distributor.name })
    }
    return hierarchy
  }

  if (tenant.type === 'distributor') {
    return [{ id: tenant.id, type: 'distributor', name: tenant.name }]
  }

  return []
}

const loadTenant = async (tenantId: string) => {
  const db = getDb()
  const [tenant] = await db
    .select({ id: tenants.id, type: tenants.type, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
  return tenant ?? null
}

const findDistributorForProvider = async (providerId: string) => {
  const db = getDb()
  const distributorLinks = await db
    .select({ distributorId: distributorProviders.distributorId })
    .from(distributorProviders)
    .where(eq(distributorProviders.providerId, providerId))
    .limit(1)

  const distributorId = distributorLinks[0]?.distributorId
  if (!distributorId) {
    return null
  }

  const [distributor] = await db
    .select({ id: tenants.id, type: tenants.type })
    .from(tenants)
    .where(eq(tenants.id, distributorId))
    .limit(1)

  if (!distributor || distributor.type !== 'distributor') {
    return null
  }

  return distributor
}

const normalizeLookupInput = (
  input?: string | null | EmailProviderLookupContext
): EmailProviderLookupContext => {
  if (typeof input === 'string' || input === null || input === undefined) {
    return { organizationId: typeof input === 'string' ? input : null }
  }
  return input
}

const buildTargetDescriptors = async (
  context: EmailProviderLookupContext
): Promise<TargetDescriptor[]> => {
  const descriptors: TargetDescriptor[] = []
  if (context.organizationId) {
    const hierarchy = await getHierarchyForOrganization(context.organizationId)
    descriptors.push(...hierarchy)
  } else if (context.tenantId) {
    const hierarchy = await getHierarchyForTenant(context.tenantId)
    descriptors.push(...hierarchy)
  }
  descriptors.push({ id: GLOBAL_TARGET_KEY, type: 'global', name: 'Global standard' })
  return descriptors
}

export const resolveEmailProviderChain = async (
  input?: string | null | EmailProviderLookupContext
) => {
  const context = normalizeLookupInput(input)
  const targets = await buildTargetDescriptors(context)
  const chain: EmailProviderChainEntry[] = []
  let effectiveFound = false

  for (const target of targets) {
    const record = await fetchByTargetKey(target.id)
    const profile = record ? tryDecryptProfile(record) : null
    const summary = record
      ? toSummary(record, profile)
      : target.type === 'organization'
        ? baseSummary(target.type, target.id, null)
        : target.type === 'global'
          ? baseSummary('global')
          : baseSummary(target.type, null, target.id)

    if (record) {
      summary.subjectPrefix = record.subjectPrefix ?? null
      summary.supportContact = record.supportContact ?? null
    }

    const isEffective = Boolean(!effectiveFound && record && record.isActive && profile)
    if (isEffective) {
      effectiveFound = true
    }

    const entry: EmailProviderChainEntry = {
      targetType: target.type,
      targetKey: target.id,
      targetName: target.name,
      summary,
      isEffective
    }

    chain.push(entry)
  }

  return chain
}

export interface EmailSenderContext {
  profile: EmailProviderProfile | null
  subjectPrefix: string | null
  supportContact: string | null
  emailDarkMode: boolean
  source: TargetDescriptor | null
}

export const getEffectiveEmailSenderContext = async (
  input?: string | null | EmailProviderLookupContext
): Promise<EmailSenderContext> => {
  const context = normalizeLookupInput(input)
  const targets = await buildTargetDescriptors(context)
  const cryptoKey = ensureCryptoKey()

  for (const target of targets) {
    const record = await fetchByTargetKey(target.id)
    if (!record || !record.isActive || record.targetType !== target.type) {
      continue
    }
    const profile = tryDecryptProfile(record, cryptoKey)
    if (!profile) {
      continue
    }
    return {
      profile,
      subjectPrefix: record.subjectPrefix ?? null,
      supportContact: record.supportContact ?? null,
      emailDarkMode: Boolean(record.emailDarkMode),
      source: target
    }
  }

  return {
    profile: null,
    subjectPrefix: null,
    supportContact: null,
    emailDarkMode: false,
    source: null
  }
}

export const getEffectiveEmailProviderProfile = async (
  input?: string | null | EmailProviderLookupContext
) => {
  const context = await getEffectiveEmailSenderContext(input)
  return context.profile
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

export interface EmailProviderLookupContext {
  organizationId?: string | null
  tenantId?: string | null
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

