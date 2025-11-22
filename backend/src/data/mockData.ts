import type {
  ContainerInstance,
  ContainerProject,
  DnsRecord,
  DnsZone,
  Organisation,
  OrganisationInvitation,
  OrganisationMember,
  VmInstance,
  WordpressSite
} from '../types/domain.js'

export const organisations: Organisation[] = [
  { id: 'org-coreit', name: 'CoreIT Demo', role: 'owner' },
  { id: 'org-internal', name: 'Internal IT', role: 'operator' }
]

export const organisationMembers: OrganisationMember[] = [
  {
    id: 'member-coreit-1',
    organisationId: 'org-coreit',
    userId: 'user-anna',
    email: 'anna@example.com',
    displayName: 'Anna Andersson',
    role: 'owner',
    status: 'active',
    invitedAt: '2025-11-10T08:00:00Z',
    createdAt: '2025-11-10T08:00:00Z',
    updatedAt: '2025-11-15T09:15:00Z'
  },
  {
    id: 'member-coreit-2',
    organisationId: 'org-coreit',
    userId: 'user-fredrik',
    email: 'fredrik@example.com',
    displayName: 'Fredrik Karlsson',
    role: 'admin',
    status: 'active',
    invitedAt: '2025-11-12T10:30:00Z',
    createdAt: '2025-11-12T10:30:00Z',
    updatedAt: '2025-11-18T11:00:00Z'
  },
  {
    id: 'member-coreit-3',
    organisationId: 'org-coreit',
    email: 'guest@example.com',
    displayName: 'Gäst Användare',
    role: 'member',
    status: 'invited',
    invitedAt: '2025-11-19T13:45:00Z',
    createdAt: '2025-11-19T13:45:00Z',
    updatedAt: '2025-11-19T13:45:00Z'
  },
  {
    id: 'member-internal-1',
    organisationId: 'org-internal',
    userId: 'user-sofia',
    email: 'sofia@example.com',
    displayName: 'Sofia Lind',
    role: 'owner',
    status: 'active',
    invitedAt: '2025-10-21T07:15:00Z',
    createdAt: '2025-10-21T07:15:00Z',
    updatedAt: '2025-11-01T08:30:00Z'
  },
  {
    id: 'member-internal-2',
    organisationId: 'org-internal',
    email: 'consultant@example.com',
    displayName: 'Consultant AB',
    role: 'member',
    status: 'inactive',
    invitedAt: '2025-09-02T09:00:00Z',
    createdAt: '2025-09-02T09:00:00Z',
    updatedAt: '2025-10-01T09:30:00Z'
  }
]

export const organisationInvitations: OrganisationInvitation[] = [
  {
    id: 'invite-coreit-1',
    organisationId: 'org-coreit',
    email: 'new.engineer@example.com',
    role: 'member',
    token: 'inv-coreit-token-1',
    expiresAt: '2025-12-01T00:00:00Z',
    status: 'pending',
    invitedBy: 'user-anna',
    createdAt: '2025-11-18T14:00:00Z'
  }
]

export const dnsZones: DnsZone[] = [
  { id: 'zone-1', name: 'example.com', status: 'active', organisationId: 'org-coreit' },
  { id: 'zone-2', name: 'appar.se', status: 'active', organisationId: 'org-internal' }
]

export const dnsRecords: DnsRecord[] = [
  {
    id: 'rec-1',
    zoneId: 'zone-1',
    organisationId: 'org-coreit',
    type: 'A',
    name: 'example.com',
    content: '192.0.2.10',
    ttl: 3600
  },
  {
    id: 'rec-2',
    zoneId: 'zone-1',
    organisationId: 'org-coreit',
    type: 'CNAME',
    name: 'www',
    content: 'example.com',
    ttl: 300
  },
  {
    id: 'rec-3',
    zoneId: 'zone-2',
    organisationId: 'org-internal',
    type: 'TXT',
    name: '_spf',
    content: '"v=spf1 include:_spf.google.com ~all"',
    ttl: 1800
  }
]

export const containerProjects: ContainerProject[] = [
  { id: 'proj-1', name: 'Customer Edge', organisationId: 'org-coreit' },
  { id: 'proj-2', name: 'Internal Apps', organisationId: 'org-internal' }
]

export const containerInstances: ContainerInstance[] = [
  {
    id: 'ct-1',
    name: 'dns-forwarder-01',
    status: 'RUNNING',
    image: 'ubuntu:24.04',
    cpu: '2',
    memory: '4GB',
    projectId: 'proj-1',
    organisationId: 'org-coreit'
  },
  {
    id: 'ct-2',
    name: 'wp-cache',
    status: 'STOPPED',
    image: 'nginx:1.25',
    cpu: '1',
    memory: '2GB',
    projectId: 'proj-1',
    organisationId: 'org-coreit'
  }
]

export const vms: VmInstance[] = [
  {
    id: 'vm-1',
    name: 'wordpress-ha-01',
    powerState: 'poweredOn',
    cpu: '4',
    memory: '8GB',
    disk: '120GB',
    platform: 'ESXi',
    organisationId: 'org-coreit'
  },
  {
    id: 'vm-2',
    name: 'morpheus-api-01',
    powerState: 'poweredOff',
    cpu: '2',
    memory: '4GB',
    disk: '80GB',
    platform: 'Morpheus',
    organisationId: 'org-internal'
  }
]

export const wordpressSites: WordpressSite[] = [
  {
    id: 'wp-1',
    name: 'Marketing',
    domain: 'marketing.example.com',
    status: 'healthy',
    version: '6.6.2',
    lastBackup: '2025-11-19T05:45:00Z',
    region: 'Karlstad',
    organisationId: 'org-coreit'
  },
  {
    id: 'wp-2',
    name: 'Docs',
    domain: 'docs.example.com',
    status: 'warning',
    version: '6.5.3',
    lastBackup: '2025-11-18T22:00:00Z',
    region: 'Karlstad',
    organisationId: 'org-internal'
  }
]

