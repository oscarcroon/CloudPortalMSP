import type { RbacRole } from '~/constants/rbac'

export type OrganizationMemberStatus = 'active' | 'invited' | 'suspended'
export type OrganizationInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export type OrganizationIdpType = 'none' | 'saml' | 'oidc'

export type AdminEmailProviderType = 'smtp' | 'graph'

export interface AdminEmailProviderSummary {
  targetType: 'global' | 'provider' | 'distributor' | 'organization'
  organizationId?: string | null
  tenantId?: string | null
  providerType?: AdminEmailProviderType
  emailLanguage?: 'sv' | 'en' | null
  fromEmail?: string
  fromName?: string | null
  replyToEmail?: string | null
  subjectPrefix?: string | null
  supportContact?: string | null
  emailDarkMode?: boolean
  disclaimerMarkdown?: string | null
  isActive: boolean
  hasConfig: boolean
  lastTestedAt?: number
  lastTestStatus?: string | null
  lastTestError?: string | null
  settings?: (
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
  ) | null
}

export interface AdminEmailProviderPayload {
  fromEmail: string
  fromName?: string
  replyToEmail?: string
  isActive?: boolean
  emailLanguage?: 'sv' | 'en'
  subjectPrefix?: string | null
  supportContact?: string | null
  emailDarkMode?: boolean
  disclaimerMarkdown?: string | null
  provider:
    | {
        type: 'smtp'
        host: string
        port: number
        secure?: boolean
        auth?: {
          user?: string
          pass?: string
        } | null
        ignoreTls?: boolean
      }
    | {
        type: 'graph'
        tenantId: string
        clientId: string
        clientSecret: string
        scope?: string
        endpoint?: string
        senderUserId?: string
      }
}

export interface AdminEmailProviderTestPayload extends AdminEmailProviderPayload {
  testEmail: string
}

export interface EmailProviderChainEntry {
  targetType: 'global' | 'provider' | 'distributor' | 'organization'
  targetKey: string
  targetName?: string | null
  summary: AdminEmailProviderSummary
  isEffective: boolean
}

export interface OrganizationAuthSettings {
  organizationId: string
  idpType: OrganizationIdpType
  ssoEnforced: boolean
  allowLocalLoginForOwners: boolean
  idpConfig: Record<string, unknown> | null
}

export interface AdminOrganizationSummary {
  id: string
  name: string
  slug: string
  status: string
  requireSso: boolean
  defaultRole: RbacRole
  billingEmail?: string | null
  tenantId?: string | null
  tenantName?: string | null
  tenantSlug?: string | null
  createdAt: number
  memberCount: number
  ssoEnforced: boolean
  hasEmailOverride?: boolean
}

export interface AdminOrganizationDetail {
  organization: {
    id: string
    name: string
    slug: string
    status: string
    tenantId?: string | null
    billingEmail?: string | null
    coreId?: string | null
    defaultRole: RbacRole
    requireSso: boolean
    createdAt: number
    updatedAt?: number | null
  }
  provider?: {
    id: string
    name: string
    slug: string
  } | null
  authSettings: OrganizationAuthSettings
  stats: {
    memberCount: number
    activeMembers: number
    pendingInvites: number
  }
}

export interface AdminCreateOrganizationPayload {
  name: string
  slug?: string
  billingEmail?: string
  coreId?: string
  defaultRole?: RbacRole
  owner: {
    email: string
    fullName?: string
  }
}

export interface AdminCreateOrganizationResponse {
  organization: AdminOrganizationDetail['organization']
  authSettings: OrganizationAuthSettings
  owner: {
    id: string
    email: string
    fullName?: string | null
  }
}

export interface AdminDelegation {
  id: string
  orgId: string
  subjectType: 'user'
  subjectId: string
  subjectEmail?: string | null
  subjectName?: string | null
  permissionKeys: string[]
  expiresAt?: number | null
  note?: string | null
  revokedAt?: number | null
  revokedBy?: string | null
  createdAt?: number | null
}

export interface AdminDelegationsResponse {
  organization: {
    id: string
    name: string
    slug: string
  }
  delegations: AdminDelegation[]
}

export interface AdminMoveOrganizationProviderPayload {
  newTenantId: string | null
}

export interface AdminUpdateOrganizationPayload {
  name?: string
  slug?: string
  billingEmail?: string | null
  coreId?: string | null
  defaultRole?: RbacRole
  requireSso?: boolean
}

export interface AdminOrganizationMember {
  membershipId: string
  userId: string
  email: string
  fullName?: string | null
  role: RbacRole
  status: OrganizationMemberStatus
  addedAt: number
}

export interface AdminOrganizationInvite {
  id: string
  email: string
  role: RbacRole
  status: OrganizationInviteStatus
  invitedAt: number
  expiresAt: number
  invitedBy?: {
    id: string
    email: string
    fullName?: string | null
  } | null
}

export interface AdminOrganizationMembersResponse {
  organization: {
    id: string
    name: string
    requireSso: boolean
  }
  members: AdminOrganizationMember[]
  invites: AdminOrganizationInvite[]
}

export interface AdminInviteMemberPayload {
  email: string
  role?: RbacRole
  directAdd?: boolean
}

export interface AdminInviteMemberResponse {
  member?: AdminOrganizationMember
  invite?: AdminOrganizationInvite
}

export interface AdminUpdateMemberRolePayload {
  role: RbacRole
}

export interface AdminRemoveMemberResponse {
  member: AdminOrganizationMember
}

export interface AdminUpdateAuthSettingsPayload {
  requireSso?: boolean
  idpType?: OrganizationIdpType
  allowLocalLoginForOwners?: boolean
  idpConfig?: Record<string, unknown> | null
}

export type AdminUserStatus = 'active' | 'disabled'

export interface AdminUserSummary {
  id: string
  email: string
  fullName?: string | null
  status: AdminUserStatus
  isSuperAdmin: boolean
  forcePasswordReset: boolean
  lastLoginAt?: number | null
  createdAt: number
  organizationCount: number
  activeOrganizations: number
}

export interface AdminUsersResponse {
  users: AdminUserSummary[]
}

export interface AdminUserDetail {
  user: {
    id: string
    email: string
    fullName?: string | null
    status: AdminUserStatus
    isSuperAdmin: boolean
    forcePasswordReset: boolean
    lastLoginAt?: number | null
    createdAt: number
    updatedAt: number
  }
  organizations: Array<{
    id: string
    name: string
    role: RbacRole
    membershipStatus: OrganizationMemberStatus
  }>
}

export interface AdminUpdateUserStatusPayload {
  status: AdminUserStatus
}

export type TenantType = 'provider' | 'distributor' | 'organization'
export type TenantRole = 'admin' | 'user' | 'viewer' | 'support'

export interface AdminTenantSummary {
  id: string
  name: string
  slug: string
  type: TenantType
  parentTenantId?: string | null
  status: string
  createdAt: number
  memberCount: number
  organizationCount?: number
  hasEmailOverride?: boolean
}

export interface AdminTenantDetail {
  tenant: {
    id: string
    name: string
    slug: string
    type: TenantType
    parentTenantId?: string | null
    status: string
    createdAt: number
    updatedAt: number
  }
  members: Array<{
    id: string
    userId: string
    role: TenantRole
    status: string
    user: {
      id: string
      email: string
      fullName?: string | null
      status: string
    }
  }>
  childTenants: AdminTenantSummary[] // Legacy: for backward compatibility
  linkedTenants?: AdminTenantSummary[] // Providers for Distributors, Distributors for Providers
  organizations?: Array<{
    id: string
    name: string
    slug: string
    status: string
    tenantId: string | null
    createdAt: number
    hasEmailOverride?: boolean
  }>
}

export interface AdminCreateTenantPayload {
  name: string
  slug?: string
  type: 'provider' | 'distributor'
  distributorIds?: string[] // For providers: which distributors to link to
  owner: {
    email: string
    fullName?: string
  }
}

export interface AdminCreateTenantResponse {
  tenant: AdminTenantSummary
  owner: {
    id: string
    email: string
    fullName?: string | null
  }
}

export interface AdminTenantMember {
  membershipId: string
  userId: string
  email: string
  fullName?: string | null
  role: TenantRole
  mspRoles: TenantRole[]
  status: string
  includeChildren: boolean
  addedAt: string | null
}

export interface AdminTenantInvite {
  id: string
  email: string
  role: TenantRole
  status: 'pending' | 'accepted' | 'cancelled' | 'expired'
  invitedAt: string | null
  expiresAt: string | null
  willCreateOrganization: boolean
  organizationName?: string
  invitedBy: {
    id: string
    email: string
    fullName?: string | null
  } | null
}

export interface AdminTenantInvitePayload {
  email: string
  role: TenantRole
  includeChildren?: boolean
}

export interface AdminTenantMembersResponse {
  tenant: {
    id: string
    name: string
    slug: string
    type: TenantType
    status: string
  }
  members: AdminTenantMember[]
  invites: AdminTenantInvite[]
}

