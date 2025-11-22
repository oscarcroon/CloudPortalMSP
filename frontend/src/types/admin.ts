import type { RbacRole } from '~/constants/rbac'

export type OrganizationMemberStatus = 'active' | 'invited' | 'suspended'
export type OrganizationInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export type OrganizationIdpType = 'none' | 'saml' | 'oidc'

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
  allowSelfSignup: boolean
  defaultRole: RbacRole
  billingEmail?: string | null
  createdAt: number
  memberCount: number
  ssoEnforced: boolean
}

export interface AdminOrganizationDetail {
  organization: {
    id: string
    name: string
    slug: string
    status: string
    billingEmail?: string | null
    defaultRole: RbacRole
    requireSso: boolean
    allowSelfSignup: boolean
    createdAt: number
    updatedAt?: number | null
  }
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
  requireSso?: boolean
  allowSelfSignup?: boolean
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

export interface AdminUpdateOrganizationPayload {
  name?: string
  slug?: string
  billingEmail?: string | null
  defaultRole?: RbacRole
  requireSso?: boolean
  allowSelfSignup?: boolean
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
  members: AdminOrganizationMember[]
  invites: AdminOrganizationInvite[]
}

export interface AdminInviteMemberPayload {
  email: string
  role?: RbacRole
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
  allowSelfSignup?: boolean
  idpType?: OrganizationIdpType
  allowLocalLoginForOwners?: boolean
  idpConfig?: Record<string, unknown> | null
}

