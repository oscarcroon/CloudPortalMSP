import type { RbacRole, TenantRole } from '~/constants/rbac'
import type { ModuleId } from '~/constants/modules'
import type { SupportedLocaleCode } from '~/constants/i18n'
import type { BrandingTargetType } from '../database/schema'

export interface AuthUser {
  id: string
  email: string
  fullName?: string | null
  status: string
  defaultOrgId?: string | null
  isSuperAdmin: boolean
  forcePasswordReset: boolean
  locale: SupportedLocaleCode
}

export interface AuthOrganization {
  id: string
  name: string
  slug: string
  role: RbacRole
  status: string
  isSuspended: boolean
  logoUrl?: string | null
  requireSso: boolean
  hasLocalLoginOverride: boolean
  tenantId?: string | null
  lastAccessedAt?: number | null
  accessType?: 'direct' | 'msp' | 'delegation' | 'superadmin'
  expiresAt?: number | null
}

export interface AuthTenant {
  id: string
  name: string
  slug: string
  type: 'provider' | 'distributor' | 'organization'
  parentTenantId?: string | null
  role: TenantRole
  includeChildren: boolean
  status: string
}

export interface AuthState {
  user: AuthUser
  organizations: AuthOrganization[]
  tenants: AuthTenant[]
  orgRoles: Record<string, RbacRole>
  tenantRoles: Record<string, TenantRole>
  tenantIncludeChildren: Record<string, boolean>
  currentOrgId: string | null
  currentTenantId: string | null
  favoriteModules: ModuleId[]
  sessionIssuedAt: string
  branding: AuthBrandingState | null
}

export interface SessionTokenPayload {
  userId: string
  orgRoles: Record<string, RbacRole>
  tenantRoles?: Record<string, TenantRole>
  tenantIncludeChildren?: Record<string, boolean>
  currentOrgId: string | null
  currentTenantId?: string | null
  version: number
  iat?: number
  exp?: number
}

export interface ZeroTrustIdentity {
  email: string
  issuer?: string
  subject?: string
  audience?: string | string[]
  expiresAt?: number
}

export interface AuthBrandingState {
  organizationTheme: BrandingThemeLayer | null
  tenantTheme: BrandingThemeLayer | null
  distributorTheme: BrandingThemeLayer | null
  globalTheme?: BrandingThemeLayer | null
  activeTheme: BrandingActiveTheme
}

export interface BrandingThemeLayer {
  targetType: BrandingTargetType
  targetId: string
  name: string
  logoUrl: string | null
  appLogoLightUrl: string | null
  appLogoDarkUrl: string | null
  loginLogoLightUrl: string | null
  loginLogoDarkUrl: string | null
  loginBackgroundUrl: string | null
  loginBackgroundTint: string | null
  loginBackgroundTintOpacity: number | null
  navigationBackgroundColor: string | null
  accentColor: string | null
  paletteKey: string | null
  updatedAt: number | null
  source: 'custom' | 'inherited'
}

export interface BrandingActiveTheme {
  logoUrl: string | null
  appLogoLightUrl: string | null
  appLogoDarkUrl: string | null
  loginLogoLightUrl: string | null
  loginLogoDarkUrl: string | null
  loginBackgroundUrl: string | null
  loginBackgroundTint: string | null
  loginBackgroundTintOpacity: number
  navigationBackgroundColor: string
  accentColor: string
  paletteKey: string | null
  logoSource: BrandingThemeSource
  accentSource: BrandingThemeSource
  loginLogoSource: BrandingThemeSource
  loginBackgroundSource: BrandingThemeSource
  navBackgroundSource: BrandingThemeSource
}

export interface BrandingThemeSource {
  targetType: BrandingTargetType | 'default'
  targetId: string | null
  name: string | null
}

