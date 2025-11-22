import type { RbacRole } from '~/constants/rbac'

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
  orgRoles: Record<string, RbacRole>
  currentOrgId: string | null
  sessionIssuedAt: string
}

