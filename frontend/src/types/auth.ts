import type { RbacRole, TenantRole } from '~/constants/rbac'

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

