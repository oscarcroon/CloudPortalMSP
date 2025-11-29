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

export interface BrandingLayer {
  targetType: BrandingTargetType
  targetId: string
  name: string
  logoUrl: string | null
  accentColor: string | null
  paletteKey: string | null
  updatedAt: number | null
  source: 'custom' | 'inherited'
}

export interface BrandingActiveTheme {
  logoUrl: string | null
  accentColor: string
  paletteKey: string | null
  logoSource: BrandingSourceInfo
  accentSource: BrandingSourceInfo
}

export interface BrandingResolution {
  organizationTheme: BrandingLayer | null
  tenantTheme: BrandingLayer | null
  distributorTheme: BrandingLayer | null
  activeTheme: BrandingActiveTheme
}

export interface BrandingAttributeInput {
  accentColor?: string | null
  paletteKey?: string | null
}

export interface LogoFilePayload {
  filename: string
  mimeType?: string | null
  data: Buffer
}

export interface OrganizationBrandingTarget {
  targetType: 'organization'
  organizationId: string
}

export interface TenantBrandingTarget {
  targetType: 'provider' | 'distributor'
  tenantId: string
}

export type BrandingTarget = OrganizationBrandingTarget | TenantBrandingTarget

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
  const existing = await findBrandingRow(db, target)
  const previousLogo = existing?.logoUrl
  const logoUrl = await persistLogoFile(target, payload, previousLogo)
  await writeBrandingRecord(
    db,
    target,
    {
      logoUrl
    },
    userId
  )

  if (target.targetType === 'organization') {
    await syncOrganizationLogoColumn(db, target.organizationId, logoUrl)
  }

  return { logoUrl }
}

export async function removeBrandingLogo(
  target: BrandingTarget,
  userId?: string,
  db = getDb()
) {
  const existing = await findBrandingRow(db, target)
  if (!existing?.logoUrl) {
    return { removed: false }
  }

  deleteLogoFile(existing.logoUrl)
  await writeBrandingRecord(
    db,
    target,
    {
      logoUrl: null
    },
    userId
  )

  if (target.targetType === 'organization') {
    await syncOrganizationLogoColumn(db, target.organizationId, null)
  }

  return { removed: true }
}

export async function deleteBrandingTheme(target: BrandingTarget, db = getDb()) {
  const existing = await findBrandingRow(db, target)
  if (!existing) {
    return
  }

  deleteLogoFile(existing.logoUrl)
  const where = buildTargetWhere(target)
  await db.delete(brandingThemes).where(where)

  if (target.targetType === 'organization') {
    await syncOrganizationLogoColumn(db, target.organizationId, null)
  }
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

  return buildResolution(organizationTheme, providerTheme, distributorTheme)
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

  return buildResolution(organizationTheme, tenantTheme, distributorTheme)
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
  return {
    targetType: input.targetType,
    targetId: input.targetId,
    name: input.name,
    logoUrl: normalizeStoredLogoUrl(input.theme?.logoUrl),
    accentColor: input.theme?.accentColor ?? null,
    paletteKey: input.theme?.paletteKey ?? null,
    updatedAt: getTimestampValue(input.theme?.updatedAt),
    source: input.theme ? 'custom' : 'inherited'
  }
}

function buildResolution(
  organizationTheme: BrandingLayer | null,
  tenantTheme: BrandingLayer | null,
  distributorTheme: BrandingLayer | null
): BrandingResolution {
  const layers = [organizationTheme, tenantTheme, distributorTheme].filter(
    Boolean
  ) as BrandingLayer[]

  const logoSource = determineLogoSource(layers)
  const accentSource = determineAccentSource(layers)

  const activeTheme: BrandingActiveTheme = {
    logoUrl: logoSource.value,
    accentColor: accentSource.color,
    paletteKey: accentSource.paletteKey,
    logoSource: logoSource.source,
    accentSource: accentSource.source
  }

  return {
    organizationTheme,
    tenantTheme,
    distributorTheme,
    activeTheme
  }
}

function determineLogoSource(layers: BrandingLayer[]) {
  for (const layer of layers) {
    if (layer.logoUrl) {
      return {
        value: layer.logoUrl,
        source: {
          targetType: layer.targetType,
          targetId: layer.targetId,
          name: layer.name
        }
      }
    }
  }

  return {
    value: null,
    source: {
      targetType: 'default',
      targetId: null,
      name: null
    }
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
    source: {
      targetType: 'default',
      targetId: null,
      name: null
    }
  }
}

function normalizeAttributeInput(attributes: BrandingAttributeInput) {
  const hasAccent = Object.prototype.hasOwnProperty.call(attributes, 'accentColor')
  const hasPalette = Object.prototype.hasOwnProperty.call(attributes, 'paletteKey')

  if (!hasAccent && !hasPalette) {
    return null
  }

  const payload: Record<string, string | null> = {}

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

  return payload
}

async function findBrandingRow(db: DrizzleDb, target: BrandingTarget) {
  const where = buildTargetWhere(target)
  const rows = await db.select().from(brandingThemes).where(where).limit(1)
  return rows[0] ?? null
}

function buildTargetWhere(target: BrandingTarget) {
  if (target.targetType === 'organization') {
    return eq(brandingThemes.organizationId, target.organizationId)
  }
  return and(
    eq(brandingThemes.targetType, target.targetType),
    eq(brandingThemes.tenantId, target.tenantId)
  )
}

async function writeBrandingRecord(
  db: DrizzleDb,
  target: BrandingTarget,
  changes: Record<string, string | null>,
  userId?: string
) {
  const existing = await findBrandingRow(db, target)
  const timestamp = new Date()
  if (existing) {
    const update: Record<string, unknown> = {
      updatedAt: timestamp,
      updatedByUserId: userId ?? existing.updatedByUserId ?? null
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'logoUrl')) {
      update.logoUrl = changes.logoUrl
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'accentColor')) {
      update.accentColor = changes.accentColor
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'paletteKey')) {
      update.paletteKey = changes.paletteKey
    }

    await db.update(brandingThemes).set(update).where(eq(brandingThemes.id, existing.id))
    return
  }

  const insertPayload: typeof brandingThemes.$inferInsert = {
    id: createId(),
    targetType: target.targetType,
    tenantId: target.targetType === 'organization' ? null : target.tenantId,
    organizationId: target.targetType === 'organization' ? target.organizationId : null,
    logoUrl: Object.prototype.hasOwnProperty.call(changes, 'logoUrl') ? changes.logoUrl ?? null : null,
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
  previousLogo?: string | null
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

  const filename = `${target.targetType}-${getTargetId(target)}-${Date.now()}${extension}`
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

