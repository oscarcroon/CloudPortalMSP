import type { RbacRole } from '~/constants/rbac'

export interface AuthUser {
  id: string
  email: string
  fullName?: string | null
  status: string
  defaultOrgId?: string | null
  isSuperAdmin: boolean
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
}

export interface AuthState {
  user: AuthUser
  organizations: AuthOrganization[]
  orgRoles: Record<string, RbacRole>
  currentOrgId: string | null
  sessionIssuedAt: string
}

export interface SessionTokenPayload {
  userId: string
  orgRoles: Record<string, RbacRole>
  currentOrgId: string | null
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

