import { definePluginManifest } from '../_shared/module-manifest'

const manifest = definePluginManifest({
  module: {
    key: 'cloudflare-dns',
    name: 'Cloudflare DNS',
    description: 'Manage Cloudflare DNS zones, records och åtkomst.',
    category: 'dns',
    icon: 'mdi:cloud-outline'
  },
  permissions: [
    { key: 'cloudflare-dns:view', description: 'View Cloudflare DNS zones and records.' },
    { key: 'cloudflare-dns:edit_records', description: 'Create or update DNS records.' },
    { key: 'cloudflare-dns:export', description: 'Export DNS zones to file.' },
    { key: 'cloudflare-dns:import', description: 'Import DNS records from file.' },
    { key: 'cloudflare-dns:admin_zones', description: 'Create or delete zones and manage settings.' },
    { key: 'cloudflare-dns:manage_org_config', description: 'Manage Cloudflare API token for the organization.' },
    { key: 'cloudflare-dns:manage_acls', description: 'Manage zone ACLs inside the plugin.' }
  ],
  healthCheck: {
    endpoint: '/api/dns/cloudflare/health',
    label: 'Cloudflare API'
  },
  rbacDefaults: {
    owner: [
      'cloudflare-dns:view',
      'cloudflare-dns:edit_records',
      'cloudflare-dns:export',
      'cloudflare-dns:import',
      'cloudflare-dns:admin_zones',
      'cloudflare-dns:manage_org_config',
      'cloudflare-dns:manage_acls'
    ],
    admin: [
      'cloudflare-dns:view',
      'cloudflare-dns:edit_records',
      'cloudflare-dns:export',
      'cloudflare-dns:import',
      'cloudflare-dns:admin_zones',
      'cloudflare-dns:manage_org_config',
      'cloudflare-dns:manage_acls'
    ],
    operator: [
      'cloudflare-dns:view',
      'cloudflare-dns:edit_records',
      'cloudflare-dns:export',
      'cloudflare-dns:import',
      'cloudflare-dns:admin_zones',
      'cloudflare-dns:manage_acls'
    ],
    member: ['cloudflare-dns:view', 'cloudflare-dns:export'],
    viewer: ['cloudflare-dns:view', 'cloudflare-dns:export'],
    support: ['cloudflare-dns:view']
  }
})

export default manifest


