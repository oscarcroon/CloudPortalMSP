import { ALL_MODULES } from '../lib/module-registry'

export type BreadcrumbMeta =
  | false
  | {
      label?: string
      labelKey?: string
      icon?: string
      to?: string
      hideLink?: boolean
    }

type RouteMapping = {
  path: string
  labelKey?: string
  label?: string
  icon?: string
}

// Longest prefix wins when matching
const ROUTE_MAPPINGS: RouteMapping[] = [
  { path: '/settings', labelKey: 'nav.settings', label: 'Inställningar', icon: 'mdi:cog-outline' },
  { path: '/settings/modules', labelKey: 'settings.modules.title', label: 'Moduler', icon: 'mdi:puzzle' },
  { path: '/settings/members', labelKey: 'settings.members.title', label: 'Medlemmar', icon: 'mdi:account-group-outline' },
  { path: '/settings/groups', labelKey: 'settings.groups.title', label: 'Grupper', icon: 'mdi:account-group-outline' },
  { path: '/settings/delegations', labelKey: 'settings.delegations.title', label: 'Delegeringar', icon: 'mdi:shield-account-outline' },
  { path: '/settings/api-tokens', labelKey: 'settings.apiTokens.title', label: 'API-tokens', icon: 'mdi:key-outline' },
  { path: '/settings/auth', labelKey: 'settings.auth.title', label: 'Auth', icon: 'mdi:shield-lock-outline' },
  { path: '/settings/email', labelKey: 'settings.email.title', label: 'E-post', icon: 'mdi:email-outline' },
  { path: '/settings/branding', labelKey: 'settings.branding.title', label: 'Branding', icon: 'mdi:palette-outline' },
  { path: '/settings/audit', labelKey: 'settings.audit.title', label: 'Revision', icon: 'mdi:history' },
  { path: '/settings/operations', labelKey: 'settings.operations.title', label: 'Driftmeddelanden', icon: 'mdi:bell-ring-outline' },

  // Tenant Admin Dashboard & Tenant Management
  { path: '/tenant-admin', labelKey: 'admin.tenantAdmin.title', label: 'Tenant-administration', icon: 'mdi:office-building-cog' },
  { path: '/tenant-admin/tenants', labelKey: 'admin.sections.tenants.title', label: 'Tenants', icon: 'mdi:office-building-outline' },
  { path: '/tenant-admin/distributors', label: 'Distributörer', icon: 'mdi:city' },
  { path: '/tenant-admin/organizations', label: 'Organisationer', icon: 'mdi:domain' },
  { path: '/tenant-admin/organizations/new', label: 'Skapa organisation', icon: 'mdi:home-plus' },
  { path: '/tenant-admin/operations/visibility', label: 'Driftmeddelanden', icon: 'mdi:bell-ring-outline' },

  // Platform Admin (Superadmin)
  { path: '/platform-admin', labelKey: 'nav.platformAdmin', label: 'Plattformsadmin', icon: 'mdi:shield-crown' },
  { path: '/platform-admin/organizations', labelKey: 'admin.sections.organizations.title', label: 'Organisationer', icon: 'mdi:domain' },
  { path: '/platform-admin/users', labelKey: 'admin.sections.users.title', label: 'Användare', icon: 'mdi:account-multiple-outline' },
  { path: '/platform-admin/modules', labelKey: 'admin.sections.modules.title', label: 'Moduler', icon: 'mdi:puzzle-outline' },
  { path: '/platform-admin/settings', labelKey: 'admin.title', label: 'Inställningar', icon: 'mdi:cog-outline' },
  { path: '/platform-admin/settings/email', labelKey: 'admin.sections.adminEmail.title', label: 'E-post', icon: 'mdi:email-outline' },
  { path: '/platform-admin/branding', labelKey: 'admin.sections.globalBranding.title', label: 'Branding', icon: 'mdi:palette-outline' },
  { path: '/platform-admin/audit-logs', labelKey: 'admin.sections.auditLogs.title', label: 'Loggar', icon: 'mdi:history' },
  { path: '/platform-admin/rbac-matrix', labelKey: 'admin.sections.rbacMatrix.title', label: 'RBAC Matrix', icon: 'mdi:table-account' },

  { path: '/docs', labelKey: 'nav.docs', label: 'Dokumentation', icon: 'mdi:book-open-variant' },
  { path: '/profile', labelKey: 'nav.profile', label: 'Profil', icon: 'mdi:account-outline' },
  { path: '/profile/operations', labelKey: 'profile.operations.title', label: 'Driftmeddelanden', icon: 'mdi:bell-ring-outline' },
  { path: '/support', labelKey: 'nav.support', label: 'Support', icon: 'mdi:lifecycle' },
  { path: '/vms', labelKey: 'nav.vms', label: 'VMs', icon: 'mdi:server' },
  { path: '/containers', labelKey: 'nav.containers', label: 'Containers', icon: 'mdi:docker' },
  { path: '/monitoring', labelKey: 'nav.monitoring', label: 'Monitoring', icon: 'mdi:chart-timeline-variant' },
  { path: '/managed-server', labelKey: 'nav.managedServer', label: 'Managed Server', icon: 'mdi:server-security' },
  { path: '/wordpress', labelKey: 'nav.wordpress', label: 'WordPress', icon: 'mdi:wordpress' },
  { path: '/ncentral', labelKey: 'nav.ncentral', label: 'N-Central', icon: 'mdi:remote-desktop' },
  { path: '/cloudflare-dns', labelKey: 'cloudflareDns.title', label: 'Cloudflare DNS', icon: 'mdi:shield-check-outline' },
  { path: '/cloudflare-dns/admin', labelKey: 'cloudflareDns.admin.title', label: 'Administration', icon: 'mdi:cog-outline' },
  { path: '/dns', labelKey: 'windowsDns.index.title', label: 'DNS Zones', icon: 'mdi:globe' },
  { path: '/dns/autodiscover', labelKey: 'windowsDns.autodiscover.title', label: 'Autodiscover', icon: 'mdi:auto-fix' },
  { path: '/dns/redirects', labelKey: 'windowsDns.redirects.title', label: 'Omdirigeringar', icon: 'mdi:arrow-right' }
]

const HUMANIZE_SEGMENTS: Record<string, string> = {
  'tenant-admin': 'Tenant-administration',
  'platform-admin': 'Plattformsadmin',
  settings: 'Inställningar',
  users: 'Användare',
  modules: 'Moduler',
  organizations: 'Organisationer',
  tenants: 'Tenants',
  providers: 'Providers',
  distributors: 'Distributörer',
  members: 'Medlemmar',
  groups: 'Grupper',
  audit: 'Revision',
  'audit-logs': 'Loggar',
  operations: 'Driftmeddelanden',
  visibility: 'Synlighet',
  auth: 'Auth',
  email: 'E-post',
  branding: 'Branding',
  docs: 'Dokumentation',
  support: 'Support',
  vms: 'VMs',
  dns: 'DNS',
  'cloudflare-dns': 'Cloudflare DNS',
  profile: 'Profil',
  new: 'Ny',
  overview: 'Översikt',
  delegations: 'Delegeringar',
  'api-tokens': 'API-tokens',
  'msp-roles': 'MSP-roller',
  'msp-role-templates': 'Rollmallar'
}

type ResolverResult = { label: string; labelKey?: string; icon?: string }

export const resolveFromMappings = (path: string): ResolverResult | null => {
  // Only exact match - no prefix matching to avoid duplicates
  const exact = ROUTE_MAPPINGS.find((m) => m.path === path)
  if (!exact) return null

  return {
    label: exact.label ?? exact.path,
    labelKey: exact.labelKey,
    icon: exact.icon
  }
}

export const resolveModule = (path: string): ResolverResult | null => {
  // Only exact match on module root route
  const module = ALL_MODULES.find((m) => path === m.rootRoute)
  if (!module) return null
  return { label: module.name, icon: module.icon }
}

export const humanizeSegment = (segment: string): string => {
  if (!segment) return ''
  if (HUMANIZE_SEGMENTS[segment]) return HUMANIZE_SEGMENTS[segment]
  const cleaned = segment.replace(/[-_]/g, ' ')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

// Shorten an ID for display (first 8 chars)
export const shortId = (id: string): string => {
  if (!id) return ''
  if (id.length <= 8) return id
  return id.substring(0, 8) + '…'
}
