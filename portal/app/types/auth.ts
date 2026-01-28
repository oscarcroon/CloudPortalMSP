import type { RbacRole, TenantRole } from '~/constants/rbac'
import type { ModuleId } from '~/constants/modules'
import type { SupportedLocaleCode } from '~/constants/i18n'

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
  /** Setup wizard status: 'pending' = needs setup, 'complete' = ready to use */
  setupStatus?: 'pending' | 'complete'
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

export interface AuthPayload {
  user: AuthUser
  organizations: AuthOrganization[]
  tenants: AuthTenant[]
  orgRoles: Record<string, RbacRole>
  tenantRoles: Record<string, TenantRole>
  tenantIncludeChildren: Record<string, boolean>
  currentOrgId: string | null
  currentTenantId: string | null
  sessionIssuedAt: string
  branding: BrandingState | null
  favoriteModules: ModuleId[]
}

export type AuthState = AuthPayload

export interface SessionTokenPayload {
  userId: string
  currentOrgId?: string | null
  currentTenantId?: string | null
  orgRoles?: Record<string, RbacRole>
  tenantRoles?: Record<string, TenantRole>
  tenantIncludeChildren?: Record<string, boolean>
  version: number
}

export interface BrandingState {
  organizationTheme: BrandingThemeLayer | null
  tenantTheme: BrandingThemeLayer | null
  distributorTheme: BrandingThemeLayer | null
  globalTheme?: BrandingThemeLayer | null
  activeTheme: BrandingActiveTheme
}

export interface BrandingThemeLayer {
  targetType: 'organization' | 'provider' | 'distributor'
  targetId: string
  name: string
  logoUrl: string | null
  appLogoLightUrl: string | null
  appLogoDarkUrl: string | null
  loginLogoLightUrl: string | null
  loginLogoDarkUrl: string | null
  loginBackgroundUrl: string | null
  emailLogoUrl: string | null
  loginBackgroundTint: string | null
  loginBackgroundTintOpacity: number | null
  navigationBackgroundColor: string | null
  accentColor: string | null
  paletteKey: string | null
  updatedAt: number | null
  source: 'custom' | 'inherited'
}

export interface BrandingThemeSource {
  targetType: 'organization' | 'provider' | 'distributor' | 'default'
  targetId: string | null
  name: string | null
}

export interface BrandingActiveTheme {
  logoUrl: string | null
  appLogoLightUrl: string | null
  appLogoDarkUrl: string | null
  loginLogoLightUrl: string | null
  loginLogoDarkUrl: string | null
  loginBackgroundUrl: string | null
  emailLogoUrl: string | null
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

