import type { RbacRole } from '~/constants/rbac'

export type OrganizationMemberRole = RbacRole

export type OrganizationMemberStatus = 'active' | 'invited' | 'inactive'

export interface OrganizationMember {
  id: string
  organizationId: string
  userId?: string
  email: string
  displayName?: string
  role: OrganizationMemberRole
  status: OrganizationMemberStatus
  invitedAt?: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationMembersResponse {
  organisation: {
    id: string
    name: string
    role?: string
    requireSso?: boolean
  }
  members: OrganizationMember[]
}

export interface InviteMemberPayload {
  email: string
  role: OrganizationMemberRole
  directAdd?: boolean
}

export type InvitationStatus = 'pending' | 'accepted' | 'cancelled' | 'expired'

export interface InvitationDetails {
  id: string
  organisationId: string
  email: string
  role: OrganizationMemberRole
  status: InvitationStatus
  invitedBy: string
  expiresAt: string
  createdAt: string
  acceptedAt?: string
  cancelledAt?: string
}

export interface InvitationLookupResponse {
  invitation: InvitationDetails
  organisation?: {
    id: string
    name: string
  }
}



