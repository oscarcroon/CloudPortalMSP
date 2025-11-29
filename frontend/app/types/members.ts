import type { RbacRole } from '~/constants/rbac'
import type { ModuleRoleDefinition, ModuleRoleKey } from '~/constants/modules'

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

export interface OrganizationInvitationSummary {
  id: string
  email: string
  role: OrganizationMemberRole
  status: InvitationStatus
  invitedAt: string
  expiresAt: string
  invitedBy: string | null
}

export interface OrganizationMembersResponse {
  organisation: {
    id: string
    name: string
    role?: string
    requireSso?: boolean
  }
  members: OrganizationMember[]
  invitations?: OrganizationInvitationSummary[]
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
  branding?: {
    logoUrl?: string | null
  } | null
}

export interface InvitationLookupResponse {
  invitation: InvitationDetails
  organisation?: {
    id: string
    name: string
  }
  emailExists: boolean
  hasPassword: boolean
  autoAccept: boolean
}

export type ModuleRoleSource = 'module-default' | 'distributor' | 'provider' | 'organization' | null

export interface MemberModuleRoleEntry {
  moduleId: string
  name: string
  description: string
  roleDefinitions: ModuleRoleDefinition[]
  allowedRoles: ModuleRoleKey[] | null
  allowedRolesSource: ModuleRoleSource
  defaultRoles: ModuleRoleKey[]
  grantOverrides: ModuleRoleKey[]
  denyOverrides: ModuleRoleKey[]
  effectiveRoles: ModuleRoleKey[]
  editable: boolean
  roleSource: 'custom' | 'rbac' | 'none'
}

export interface MemberModuleRolesResponse {
  organizationId: string
  memberId: string
  userId: string
  modules: MemberModuleRoleEntry[]
}

export interface UpdateMemberModuleRolesPayload {
  modules: Array<{
    moduleId: string
    roleKeys: ModuleRoleKey[]
  }>
}



