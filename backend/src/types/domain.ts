export interface OrganisationBranding {
  logoUrl?: string
}

export type OrganisationRole = 'owner' | 'admin' | 'operator' | 'viewer' | 'member'

export interface Organisation {
  id: string
  name: string
  role: OrganisationRole
  branding?: OrganisationBranding
  requireSso?: boolean
}

export type OrganisationMemberRole = 'owner' | 'admin' | 'member' | 'operator' | 'viewer'

export type OrganisationMemberStatus = 'active' | 'invited' | 'inactive'

export interface OrganisationMember {
  id: string
  organisationId: string
  userId?: string
  email: string
  displayName?: string
  role: OrganisationMemberRole
  status: OrganisationMemberStatus
  invitedAt?: string
  createdAt: string
  updatedAt: string
}

export type OrganisationInvitationStatus = 'pending' | 'accepted' | 'cancelled' | 'expired'

export interface OrganisationInvitation {
  id: string
  organisationId: string
  email: string
  role: OrganisationMemberRole
  token: string
  expiresAt: string
  status: OrganisationInvitationStatus
  invitedBy: string
  createdAt: string
  acceptedAt?: string
  cancelledAt?: string
}

export interface UserContext {
  id: string
  email: string
  organisations: Organisation[]
  activeOrganisationId: string
  permissions: string[]
}

export interface DnsZone {
  id: string
  name: string
  status: 'active' | 'pending' | 'error'
  organisationId: string
}

export interface DnsRecord {
  id: string
  zoneId: string
  organisationId: string
  type: string
  name: string
  content: string
  ttl: number
  proxied?: boolean
}

export interface ContainerProject {
  id: string
  name: string
  organisationId: string
}

export interface ContainerInstance {
  id: string
  name: string
  status: 'RUNNING' | 'STOPPED'
  image: string
  cpu: string
  memory: string
  projectId: string
  organisationId: string
}

export interface VmInstance {
  id: string
  name: string
  powerState: 'poweredOn' | 'poweredOff'
  cpu: string
  memory: string
  disk: string
  platform: 'ESXi' | 'Morpheus'
  organisationId: string
}

export interface WordpressSite {
  id: string
  name: string
  domain: string
  status: 'healthy' | 'warning' | 'failed'
  version: string
  lastBackup: string
  region: string
  organisationId: string
}

