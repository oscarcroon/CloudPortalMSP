import { createId } from '@paralleldrive/cuid2'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createError } from 'h3'
import { and, asc, eq } from 'drizzle-orm'
import type { DrizzleDb } from './db'
import { getDb } from './db'
import {
  brandingThemes,
  BrandingTargetType,
  distributorProviders,
  organizations,
  tenants
} from '../database/schema'
import {
  BRANDING_PALETTE_MAP,
  DEFAULT_BRANDING_ACCENT,
  DEFAULT_BRANDING_PALETTE_KEY,
  DEFAULT_NAV_BACKGROUND,
  DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY,
  normalizeHexColor
} from '~~/shared/branding'

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp'])
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp'
])

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(currentDir, '..', '..')
const uploadsDir = process.env.UPLOADS_DIR || path.join(frontendRoot, 'uploads')
const logosDir = path.join(uploadsDir, 'logos')
fs.mkdirSync(logosDir, { recursive: true })

const backendRoot = path.resolve(frontendRoot, '..', 'backend')
const backendUploadsDir = process.env.UPLOADS_DIR || path.join(backendRoot, 'uploads')
const backendLogosDir = path.join(backendUploadsDir, 'logos')

const DEFAULT_BASE_URL =
  process.env.PORTAL_BASE_URL || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'

type BrandingThemeRow = typeof brandingThemes.$inferSelect
type OrganizationRow = typeof organizations.$inferSelect
type TenantRow = typeof tenants.$inferSelect

export interface BrandingSourceInfo {
  targetType: BrandingTargetType | 'default'
  targetId: string | null
  name: string | null
}

export interface BrandingMediaFields {
  logoUrl: string | null
  appLogoLightUrl: string | null
  appLogoDarkUrl: string | null
  loginLogoLightUrl: string | null
  loginLogoDarkUrl: string | null
  loginBackgroundUrl: string | null
  loginBackgroundTint: string | null
  loginBackgroundTintOpacity: number | null
  navigationBackgroundColor: string | null
}

export interface BrandingLayer extends BrandingMediaFields {
  targetType: BrandingTargetType
  targetId: string
  name: string
  accentColor: string | null
  paletteKey: string | null
  updatedAt: number | null
  source: 'custom' | 'inherited'
}

export interface BrandingActiveTheme extends BrandingMediaFields {
  accentColor: string
  paletteKey: string | null
  loginBackgroundTintOpacity: number
  navBackgroundColor: string
  logoSource: BrandingSourceInfo
  accentSource: BrandingSourceInfo
  loginLogoSource: BrandingSourceInfo
  loginBackgroundSource: BrandingSourceInfo
  navBackgroundSource: BrandingSourceInfo
}

export interface BrandingResolution {
  organizationTheme: BrandingLayer | null
  tenantTheme: BrandingLayer | null
  distributorTheme: BrandingLayer | null
  globalTheme?: BrandingLayer | null
  activeTheme: BrandingActiveTheme
}

export interface BrandingAttributeInput {
  accentColor?: string | null
  paletteKey?: string | null
  loginBackgroundTint?: string | null
  loginBackgroundTintOpacity?: number | null
  navigationBackgroundColor?: string | null
}

export interface LogoFilePayload {
  filename: string
  mimeType?: string | null
  data: Buffer
}

export type BrandingMediaType =
  | 'appLogoLight'
  | 'appLogoDark'
  | 'loginLogoLight'
  | 'loginLogoDark'
  | 'loginBackground'

interface BrandingMediaConfig {
  column: keyof BrandingThemeRow
  filenameSuffix: string
  syncOrganizationLogo?: boolean
}

const BRANDING_MEDIA_CONFIG: Record<BrandingMediaType, BrandingMediaConfig> = {
  appLogoLight: {
    column: 'appLogoLightUrl',
    filenameSuffix: 'app-logo-light',
    syncOrganizationLogo: true
  },
  appLogoDark: {
    column: 'appLogoDarkUrl',
    filenameSuffix: 'app-logo-dark'
  },
  loginLogoLight: {
    column: 'loginLogoLightUrl',
    filenameSuffix: 'login-logo-light'
  },
  loginLogoDark: {
    column: 'loginLogoDarkUrl',
    filenameSuffix: 'login-logo-dark'
  },
  loginBackground: {
    column: 'loginBackgroundUrl',
    filenameSuffix: 'login-background'
  }
}

export interface OrganizationBrandingTarget {
  targetType: 'organization'
  organizationId: string
}

export interface TenantBrandingTarget {
  targetType: 'provider' | 'distributor'
  tenantId: string
}

export interface GlobalBrandingTarget {
  targetType: 'global'
}

export type BrandingTarget = OrganizationBrandingTarget | TenantBrandingTarget | GlobalBrandingTarget

const logoFilenamePattern = /\/(?:api\/)?uploads\/logos\/([^/?#]+)/i

export const LOGO_UPLOAD_LIMIT_BYTES = MAX_FILE_SIZE_BYTES

export function normalizeStoredLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) {
    return null
  }

  let normalized = logoUrl.replace(/\/api\/api\//g, '/api/')

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    normalized = normalized.replace(/\/uploads\/logos\//, '/api/uploads/logos/')
    normalized = normalized.replace(/\/api\/api\//g, '/api/')
    return normalized
  }

  if (normalized.startsWith('/uploads/logos/')) {
    return normalized.replace('/uploads/logos/', '/api/uploads/logos/')
  }

  return normalized
}

export async function resolveBrandingChain(params: {
  organizationId?: string
  tenantId?: string
}): Promise<BrandingResolution> {
  if (params.organizationId) {
    return resolveForOrganization(params.organizationId)
  }
  if (params.tenantId) {
    return resolveForTenant(params.tenantId)
  }
  throw createError({
    statusCode: 400,
    message: 'Ange organisation eller tenant för att lösa branding.'
  })
}

export async function resolveGlobalBranding(): Promise<BrandingResolution> {
  const db = getDb()
  const layer = await loadGlobalLayer(db)
  if (!layer) {
    return getDefaultBrandingResolution()
  }
  return buildResolution(null, null, null, layer)
}

export async function getBrandingTheme(target: BrandingTarget, db = getDb()) {
  return findBrandingRow(db, target)
}

export async function updateBrandingAttributes(
  target: BrandingTarget,
  attributes: BrandingAttributeInput,
  userId?: string,
  db = getDb()
) {
  const normalized = normalizeAttributeInput(attributes)
  if (!normalized) {
    return findBrandingRow(db, target)
  }
  await writeBrandingRecord(db, target, normalized, userId)
  return findBrandingRow(db, target)
}

export async function setBrandingLogo(
  target: BrandingTarget,
  payload: LogoFilePayload,
  userId?: string,
  db = getDb()
) {
  const { url } = await setBrandingMediaAsset(target, 'appLogoLight', payload, userId, db)
  return { logoUrl: url }
}

export async function removeBrandingLogo(
  target: BrandingTarget,
  userId?: string,
  db = getDb()
) {
  return removeBrandingMediaAsset(target, 'appLogoLight', userId, db)
}

export async function deleteBrandingTheme(target: BrandingTarget, db = getDb()) {
  const existing = await findBrandingRow(db, target)
  if (!existing) {
    return
  }

  const assetUrls = [
    existing.logoUrl,
    existing.appLogoLightUrl,
    existing.appLogoDarkUrl,
    existing.loginLogoLightUrl,
    existing.loginLogoDarkUrl,
    existing.loginBackgroundUrl
  ]
  for (const assetUrl of assetUrls) {
    deleteLogoFile(assetUrl)
  }
  const where = buildTargetWhere(target)
  await db.delete(brandingThemes).where(where)

  if (target.targetType === 'organization') {
    await syncOrganizationLogoColumn(db, target.organizationId, null)
  }
}

export async function setBrandingMediaAsset(
  target: BrandingTarget,
  mediaType: BrandingMediaType,
  payload: LogoFilePayload,
  userId?: string,
  db = getDb()
) {
  const config = BRANDING_MEDIA_CONFIG[mediaType]
  const existing = await findBrandingRow(db, target)
  const previousUrl = existing ? ((existing as Record<string, string | null>)[config.column] ?? null) : null
  const url = await persistLogoFile(target, payload, previousUrl, config.filenameSuffix)
  const changes: Record<string, string | null> = {
    [config.column]: url
  }
  if (config.column === 'appLogoLightUrl') {
    changes.logoUrl = url
  }
  await writeBrandingRecord(db, target, changes, userId)

  if (config.syncOrganizationLogo && target.targetType === 'organization') {
    await syncOrganizationLogoColumn(db, target.organizationId, url)
  }

  return { url }
}

export async function removeBrandingMediaAsset(
  target: BrandingTarget,
  mediaType: BrandingMediaType,
  userId?: string,
  db = getDb()
) {
  const config = BRANDING_MEDIA_CONFIG[mediaType]
  const existing = await findBrandingRow(db, target)
  if (!existing) {
    return { removed: false }
  }
  const currentUrl = (existing as Record<string, string | null>)[config.column] ?? null
  if (!currentUrl) {
    return { removed: false }
  }

  deleteLogoFile(currentUrl)
  const changes: Record<string, string | null> = {
    [config.column]: null
  }
  if (config.column === 'appLogoLightUrl') {
    changes.logoUrl = null
  }
  await writeBrandingRecord(db, target, changes, userId)

  if (config.syncOrganizationLogo && target.targetType === 'organization') {
    await syncOrganizationLogoColumn(db, target.organizationId, null)
  }

  return { removed: true }
}
async function resolveForOrganization(organizationId: string): Promise<BrandingResolution> {
  const db = getDb()
  const organization = await loadOrganization(db, organizationId)
  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organisationen kunde inte hittas.' })
  }

  const organizationTheme = await buildLayerForOrganization(db, organization)

  let providerTheme: BrandingLayer | null = null
  let distributorTheme: BrandingLayer | null = null

  if (organization.tenantId) {
    const provider = await loadTenant(db, organization.tenantId)
    if (provider && provider.type === 'provider') {
      providerTheme = await buildLayerForTenant(db, provider, 'provider')
      const distributor = await findDistributorForProvider(db, provider.id)
      if (distributor) {
        distributorTheme = await buildLayerForTenant(db, distributor, 'distributor')
      }
    }
  }

  const globalTheme = await loadGlobalLayer(db)
  return buildResolution(organizationTheme, providerTheme, distributorTheme, globalTheme)
}

async function resolveForTenant(tenantId: string): Promise<BrandingResolution> {
  const db = getDb()
  const tenant = await loadTenant(db, tenantId)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  if (tenant.type !== 'provider' && tenant.type !== 'distributor') {
    throw createError({
      statusCode: 400,
      message: 'Branding stöds endast för distributörer och leverantörer.'
    })
  }

  const tenantTheme = await buildLayerForTenant(db, tenant, tenant.type)
  let distributorTheme: BrandingLayer | null = null
  let organizationTheme: BrandingLayer | null = null

  if (tenant.type === 'provider') {
    const distributor = await findDistributorForProvider(db, tenant.id)
    if (distributor) {
      distributorTheme = await buildLayerForTenant(db, distributor, 'distributor')
    }
  }

  const globalTheme = await loadGlobalLayer(db)
  return buildResolution(organizationTheme, tenantTheme, distributorTheme, globalTheme)
}

async function buildLayerForOrganization(db: DrizzleDb, organization: OrganizationRow) {
  const record = await db
    .select()
    .from(brandingThemes)
    .where(eq(brandingThemes.organizationId, organization.id))
    .limit(1)

  const theme = record[0] ?? null
  return buildLayer({
    targetType: 'organization',
    targetId: organization.id,
    name: organization.name,
    theme
  })
}

async function buildLayerForTenant(
  db: DrizzleDb,
  tenant: TenantRow,
  targetType: 'provider' | 'distributor'
) {
  const record = await db
    .select()
    .from(brandingThemes)
    .where(
      and(
        eq(brandingThemes.targetType, targetType),
        eq(brandingThemes.tenantId, tenant.id)
      )
    )
    .limit(1)

  const theme = record[0] ?? null
  return buildLayer({
    targetType,
    targetId: tenant.id,
    name: tenant.name,
    theme
  })
}

function buildLayer(input: {
  targetType: BrandingTargetType
  targetId: string
  name: string
  theme: BrandingThemeRow | null
}): BrandingLayer {
  const normalizedAppLogoLight = normalizeStoredLogoUrl(
    input.theme?.appLogoLightUrl ?? input.theme?.logoUrl ?? null
  )
  const normalizedAppLogoDark = normalizeStoredLogoUrl(input.theme?.appLogoDarkUrl ?? null)
  const normalizedLoginLogoLight = normalizeStoredLogoUrl(input.theme?.loginLogoLightUrl ?? null)
  const normalizedLoginLogoDark = normalizeStoredLogoUrl(input.theme?.loginLogoDarkUrl ?? null)
  const normalizedLoginBackground = normalizeStoredLogoUrl(
    input.theme?.loginBackgroundUrl ?? null
  )
  return {
    targetType: input.targetType,
    targetId: input.targetId,
    name: input.name,
    logoUrl: normalizedAppLogoLight,
    appLogoLightUrl: normalizedAppLogoLight,
    appLogoDarkUrl: normalizedAppLogoDark,
    loginLogoLightUrl: normalizedLoginLogoLight,
    loginLogoDarkUrl: normalizedLoginLogoDark,
    loginBackgroundUrl: normalizedLoginBackground,
    loginBackgroundTint: input.theme?.loginBackgroundTint ?? null,
    loginBackgroundTintOpacity: input.theme?.loginBackgroundTintOpacity ?? null,
    navigationBackgroundColor: input.theme?.navigationBackgroundColor ?? null,
    accentColor: input.theme?.accentColor ?? null,
    paletteKey: input.theme?.paletteKey ?? null,
    updatedAt: getTimestampValue(input.theme?.updatedAt),
    source: input.theme ? 'custom' : 'inherited'
  }
}

function buildResolution(
  organizationTheme: BrandingLayer | null,
  tenantTheme: BrandingLayer | null,
  distributorTheme: BrandingLayer | null,
  globalTheme: BrandingLayer | null = null
): BrandingResolution {
  const layers = [organizationTheme, tenantTheme, distributorTheme, globalTheme].filter(
    Boolean
  ) as BrandingLayer[]

  const appLogoLight = determineLayerValue(layers, [
    layer => layer.appLogoLightUrl,
    layer => layer.logoUrl
  ])
  const appLogoDark = determineLayerValue(layers, [
    layer => layer.appLogoDarkUrl,
    layer => layer.appLogoLightUrl,
    layer => layer.logoUrl
  ])
  const loginLogoLight = determineLayerValue(layers, [
    layer => layer.loginLogoLightUrl,
    layer => layer.appLogoLightUrl,
    layer => layer.logoUrl
  ])
  const loginLogoDark = determineLayerValue(layers, [
    layer => layer.loginLogoDarkUrl,
    layer => layer.loginLogoLightUrl,
    layer => layer.appLogoDarkUrl,
    layer => layer.appLogoLightUrl,
    layer => layer.logoUrl
  ])
  const loginBackground = determineLayerValue(layers, [layer => layer.loginBackgroundUrl])
  const loginBackgroundTint = determineLayerValue(layers, [layer => layer.loginBackgroundTint])
  const loginBackgroundTintOpacity = determineNumericValue(
    layers,
    layer => layer.loginBackgroundTintOpacity,
    DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY
  )
  const navBackground = determineLayerValue(
    layers,
    [layer => layer.navigationBackgroundColor],
    DEFAULT_NAV_BACKGROUND
  )
  const accentSource = determineAccentSource(layers)

  const activeTheme: BrandingActiveTheme = {
    logoUrl: appLogoLight.value,
    appLogoLightUrl: appLogoLight.value,
    appLogoDarkUrl: appLogoDark.value,
    loginLogoLightUrl: loginLogoLight.value,
    loginLogoDarkUrl: loginLogoDark.value,
    loginBackgroundUrl: loginBackground.value,
    loginBackgroundTint: loginBackgroundTint.value,
    loginBackgroundTintOpacity: loginBackgroundTintOpacity.value,
    navBackgroundColor: navBackground.value ?? DEFAULT_NAV_BACKGROUND,
    accentColor: accentSource.color,
    paletteKey: accentSource.paletteKey,
    logoSource: appLogoLight.source,
    accentSource: accentSource.source,
    loginLogoSource: loginLogoLight.source,
    loginBackgroundSource: loginBackground.source,
    navBackgroundSource: navBackground.source
  }

  return {
    organizationTheme,
    tenantTheme,
    distributorTheme,
    globalTheme,
    activeTheme
  }
}

function determineAccentSource(layers: BrandingLayer[]) {
  for (const layer of layers) {
    if (layer.accentColor) {
      return {
        color: normalizeHexColor(layer.accentColor),
        paletteKey: null,
        source: {
          targetType: layer.targetType,
          targetId: layer.targetId,
          name: layer.name
        }
      }
    }
    if (layer.paletteKey) {
      const paletteEntry = BRANDING_PALETTE_MAP[layer.paletteKey]
      if (paletteEntry) {
        return {
          color: paletteEntry.hex,
          paletteKey: layer.paletteKey,
          source: {
            targetType: layer.targetType,
            targetId: layer.targetId,
            name: layer.name
          }
        }
      }
    }
  }

  return {
    color: DEFAULT_BRANDING_ACCENT,
    paletteKey: DEFAULT_BRANDING_PALETTE_KEY,
    source: DEFAULT_BRANDING_SOURCE
  }
}

export const DEFAULT_BRANDING_SOURCE: BrandingSourceInfo = {
  targetType: 'default',
  targetId: null,
  name: null
}

function determineLayerValue(
  layers: BrandingLayer[],
  selectors: Array<(layer: BrandingLayer) => string | null>,
  fallbackValue: string | null = null
) {
  for (const layer of layers) {
    for (const selector of selectors) {
      const candidate = selector(layer)
      if (candidate) {
        return {
          value: candidate,
          source: {
            targetType: layer.targetType,
            targetId: layer.targetId,
            name: layer.name
          }
        }
      }
    }
  }
  return {
    value: fallbackValue,
    source: DEFAULT_BRANDING_SOURCE
  }
}

function determineNumericValue(
  layers: BrandingLayer[],
  selector: (layer: BrandingLayer) => number | null,
  fallbackValue: number
) {
  for (const layer of layers) {
    const candidate = selector(layer)
    if (typeof candidate === 'number' && !Number.isNaN(candidate)) {
      return {
        value: candidate,
        source: {
          targetType: layer.targetType,
          targetId: layer.targetId,
          name: layer.name
        }
      }
    }
  }
  return {
    value: fallbackValue,
    source: DEFAULT_BRANDING_SOURCE
  }
}

export function getDefaultBrandingResolution(): BrandingResolution {
  const activeTheme: BrandingActiveTheme = {
    logoUrl: null,
    appLogoLightUrl: null,
    appLogoDarkUrl: null,
    loginLogoLightUrl: null,
    loginLogoDarkUrl: null,
    loginBackgroundUrl: null,
    loginBackgroundTint: null,
    loginBackgroundTintOpacity: DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY,
    navBackgroundColor: DEFAULT_NAV_BACKGROUND,
    accentColor: DEFAULT_BRANDING_ACCENT,
    paletteKey: DEFAULT_BRANDING_PALETTE_KEY,
    logoSource: DEFAULT_BRANDING_SOURCE,
    accentSource: DEFAULT_BRANDING_SOURCE,
    loginLogoSource: DEFAULT_BRANDING_SOURCE,
    loginBackgroundSource: DEFAULT_BRANDING_SOURCE,
    navBackgroundSource: DEFAULT_BRANDING_SOURCE
  }
  return {
    organizationTheme: null,
    tenantTheme: null,
    distributorTheme: null,
    globalTheme: null,
    activeTheme
  }
}

function normalizeAttributeInput(attributes: BrandingAttributeInput) {
  const hasAccent = Object.prototype.hasOwnProperty.call(attributes, 'accentColor')
  const hasPalette = Object.prototype.hasOwnProperty.call(attributes, 'paletteKey')
  const hasBackgroundTint = Object.prototype.hasOwnProperty.call(
    attributes,
    'loginBackgroundTint'
  )
  const hasBackgroundTintOpacity = Object.prototype.hasOwnProperty.call(
    attributes,
    'loginBackgroundTintOpacity'
  )
  const hasNavigationBackground = Object.prototype.hasOwnProperty.call(
    attributes,
    'navigationBackgroundColor'
  )

  if (
    !hasAccent &&
    !hasPalette &&
    !hasBackgroundTint &&
    !hasBackgroundTintOpacity &&
    !hasNavigationBackground
  ) {
    return null
  }

  const payload: Record<string, string | number | null> = {}

  if (hasAccent) {
    payload.accentColor =
      attributes.accentColor && attributes.accentColor.trim().length > 0
        ? normalizeHexColor(attributes.accentColor)
        : null
    if (payload.accentColor !== null) {
      payload.paletteKey = null
    }
  }

  if (hasPalette) {
    if (attributes.paletteKey && !BRANDING_PALETTE_MAP[attributes.paletteKey]) {
      throw createError({
        statusCode: 400,
        message: 'Ogiltig palett-nyckel.'
      })
    }
    payload.paletteKey = attributes.paletteKey ?? null
    if (payload.paletteKey !== null) {
      payload.accentColor = null
    }
  }

  if (hasBackgroundTint) {
    payload.loginBackgroundTint =
      attributes.loginBackgroundTint && attributes.loginBackgroundTint.trim().length > 0
        ? normalizeHexColor(attributes.loginBackgroundTint)
        : null
  }

  if (hasBackgroundTintOpacity) {
    const rawValue = (attributes.loginBackgroundTintOpacity ?? null) as number | string | null
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      payload.loginBackgroundTintOpacity = null
    } else {
      const numeric =
        typeof rawValue === 'number' ? rawValue : Number.parseFloat(String(rawValue))
      if (Number.isNaN(numeric)) {
        throw createError({
          statusCode: 400,
          message: 'Ogiltig bakgrundstint-procent.'
        })
      }
      const clamped = Math.min(Math.max(numeric, 0), 1)
      payload.loginBackgroundTintOpacity = clamped
    }
  }

  if (hasNavigationBackground) {
    payload.navigationBackgroundColor =
      attributes.navigationBackgroundColor &&
      attributes.navigationBackgroundColor.trim().length > 0
        ? normalizeHexColor(attributes.navigationBackgroundColor)
        : null
  }

  return payload
}

async function findBrandingRow(db: DrizzleDb, target: BrandingTarget) {
  const where = buildTargetWhere(target)
  const rows = await db.select().from(brandingThemes).where(where).limit(1)
  return rows[0] ?? null
}

async function loadGlobalLayer(db: DrizzleDb): Promise<BrandingLayer | null> {
  const rows = await db
    .select()
    .from(brandingThemes)
    .where(eq(brandingThemes.targetType, 'global'))
    .limit(1)
  const theme = rows[0] ?? null
  if (!theme) {
    return null
  }
  return buildLayer({
    targetType: 'global',
    targetId: 'global',
    name: 'Global standard',
    theme
  })
}

function buildTargetWhere(target: BrandingTarget) {
  if (target.targetType === 'organization') {
    return eq(brandingThemes.organizationId, target.organizationId)
  }
  if (target.targetType === 'global') {
    return eq(brandingThemes.targetType, 'global')
  }
  return and(
    eq(brandingThemes.targetType, target.targetType),
    eq(brandingThemes.tenantId, target.tenantId)
  )
}

async function writeBrandingRecord(
  db: DrizzleDb,
  target: BrandingTarget,
  changes: Record<string, string | number | null>,
  userId?: string
) {
  const mediaColumns = [
    'logoUrl',
    'appLogoLightUrl',
    'appLogoDarkUrl',
    'loginLogoLightUrl',
    'loginLogoDarkUrl',
    'loginBackgroundUrl',
    'loginBackgroundTint',
    'loginBackgroundTintOpacity',
    'navigationBackgroundColor'
  ] as const
  const existing = await findBrandingRow(db, target)
  const timestamp = new Date()
  if (existing) {
    const update: Record<string, unknown> = {
      updatedAt: timestamp,
      updatedByUserId: userId ?? existing.updatedByUserId ?? null
    }

    for (const column of [...mediaColumns, 'accentColor', 'paletteKey']) {
      if (Object.prototype.hasOwnProperty.call(changes, column)) {
        ;(update as Record<string, unknown>)[column] = changes[column] ?? null
      }
    }

    await db.update(brandingThemes).set(update).where(eq(brandingThemes.id, existing.id))
    return
  }

  const insertPayload: typeof brandingThemes.$inferInsert = {
    id: createId(),
    targetType: target.targetType,
    tenantId:
      target.targetType === 'provider' || target.targetType === 'distributor'
        ? target.tenantId
        : null,
    organizationId: target.targetType === 'organization' ? target.organizationId : null,
    logoUrl: Object.prototype.hasOwnProperty.call(changes, 'logoUrl') ? changes.logoUrl ?? null : null,
    appLogoLightUrl: Object.prototype.hasOwnProperty.call(changes, 'appLogoLightUrl')
      ? changes.appLogoLightUrl ?? null
      : null,
    appLogoDarkUrl: Object.prototype.hasOwnProperty.call(changes, 'appLogoDarkUrl')
      ? changes.appLogoDarkUrl ?? null
      : null,
    loginLogoLightUrl: Object.prototype.hasOwnProperty.call(changes, 'loginLogoLightUrl')
      ? changes.loginLogoLightUrl ?? null
      : null,
    loginLogoDarkUrl: Object.prototype.hasOwnProperty.call(changes, 'loginLogoDarkUrl')
      ? changes.loginLogoDarkUrl ?? null
      : null,
    loginBackgroundUrl: Object.prototype.hasOwnProperty.call(changes, 'loginBackgroundUrl')
      ? changes.loginBackgroundUrl ?? null
      : null,
    loginBackgroundTint: Object.prototype.hasOwnProperty.call(changes, 'loginBackgroundTint')
      ? changes.loginBackgroundTint ?? null
      : null,
    loginBackgroundTintOpacity: Object.prototype.hasOwnProperty.call(
      changes,
      'loginBackgroundTintOpacity'
    )
      ? (changes.loginBackgroundTintOpacity as number | null)
      : null,
    navigationBackgroundColor: Object.prototype.hasOwnProperty.call(
      changes,
      'navigationBackgroundColor'
    )
      ? changes.navigationBackgroundColor ?? null
      : null,
    accentColor: Object.prototype.hasOwnProperty.call(changes, 'accentColor')
      ? changes.accentColor ?? null
      : null,
    paletteKey: Object.prototype.hasOwnProperty.call(changes, 'paletteKey')
      ? changes.paletteKey ?? null
      : null,
    createdByUserId: userId ?? null,
    updatedByUserId: userId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  await db.insert(brandingThemes).values(insertPayload)
}

async function loadOrganization(db: DrizzleDb, organizationId: string) {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      tenantId: organizations.tenantId,
      logoUrl: organizations.logoUrl
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  return rows[0] ?? null
}

async function loadTenant(db: DrizzleDb, tenantId: string) {
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      type: tenants.type
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  return rows[0] ?? null
}

async function findDistributorForProvider(db: DrizzleDb, providerId: string) {
  const rows = await db
    .select({
      distributorId: distributorProviders.distributorId
    })
    .from(distributorProviders)
    .where(eq(distributorProviders.providerId, providerId))
    .orderBy(asc(distributorProviders.createdAt))
    .limit(1)

  const distributorId = rows[0]?.distributorId
  if (!distributorId) {
    return null
  }
  return loadTenant(db, distributorId)
}

function getSafeExtension(filename: string) {
  const extension = path.extname(filename ?? '').toLowerCase()
  return extension || '.png'
}

function buildLogoUrlFromFilename(filename: string) {
  const base = DEFAULT_BASE_URL.replace(/\/$/, '')
  return `${base}/api/uploads/logos/${filename}`
}

async function persistLogoFile(
  target: BrandingTarget,
  payload: LogoFilePayload,
  previousLogo?: string | null,
  variant = 'logo'
) {
  const extension = getSafeExtension(payload.filename)
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw createError({ statusCode: 400, message: 'Ogiltigt filformat för logotyp.' })
  }
  if (payload.mimeType && !ALLOWED_MIME_TYPES.has(payload.mimeType)) {
    throw createError({ statusCode: 400, message: 'Ogiltig MIME-typ för logotyp.' })
  }
  if (payload.data.length > MAX_FILE_SIZE_BYTES) {
    throw createError({ statusCode: 400, message: 'Filen får vara max 2 MB.' })
  }

  const filename = `${target.targetType}-${getTargetId(target)}-${variant}-${Date.now()}${extension}`
  const filePath = path.join(logosDir, filename)
  await fs.promises.writeFile(filePath, payload.data)

  if (previousLogo) {
    deleteLogoFile(previousLogo)
  }

  return buildLogoUrlFromFilename(filename)
}

function getTargetId(target: BrandingTarget) {
  if (target.targetType === 'organization') {
    return target.organizationId
  }
  if (target.targetType === 'global') {
    return 'global'
  }
  return target.tenantId
}

export function deleteLogoFile(logoUrl: string | null | undefined) {
  if (!logoUrl) {
    return
  }
  const match = logoUrl.match(logoFilenamePattern)
  const filename = match?.[1]
  if (!filename) {
    return
  }

  const primaryPath = path.join(logosDir, filename)
  if (fs.existsSync(primaryPath)) {
    fs.unlinkSync(primaryPath)
    return
  }

  const fallbackPath = path.join(backendLogosDir, filename)
  if (fs.existsSync(fallbackPath)) {
    fs.unlinkSync(fallbackPath)
  }
}

async function syncOrganizationLogoColumn(db: DrizzleDb, organizationId: string, logoUrl: string | null) {
  await db
    .update(organizations)
    .set({
      logoUrl,
      updatedAt: new Date()
    })
    .where(eq(organizations.id, organizationId))
}

function getTimestampValue(value: Date | number | null | undefined) {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  return value
}

