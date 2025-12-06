import type { PluginModuleManifest } from '@/server/lib/plugin-registry/types'

const manifest: PluginModuleManifest = {
  module: {
    key: 'cloudflare-dns',
    name: 'Cloudflare DNS',
    description: 'Manage Cloudflare DNS zones, records och åtkomst.',
    category: 'dns'
  },
  permissions: [
    { key: 'cloudflare-dns:view', description: 'View Cloudflare DNS zones and records.' },
    { key: 'cloudflare-dns:edit_records', description: 'Create or update DNS records.' },
    { key: 'cloudflare-dns:admin_zones', description: 'Create or delete zones and manage settings.' },
    { key: 'cloudflare-dns:manage_org_config', description: 'Manage Cloudflare API token for the organization.' },
    { key: 'cloudflare-dns:manage_acls', description: 'Manage zone ACLs inside the plugin.' }
  ],
  roles: [
    {
      key: 'viewer',
      label: 'Viewer',
      description: 'Can view zones and records.',
      sortOrder: 10,
      permissions: ['cloudflare-dns:view']
    },
    {
      key: 'records-editor',
      label: 'Records editor',
      description: 'Can view and edit DNS records.',
      sortOrder: 20,
      permissions: ['cloudflare-dns:view', 'cloudflare-dns:edit_records']
    },
    {
      key: 'zone-admin',
      label: 'Zone admin',
      description: 'Can manage DNS records, zones and ACLs.',
      sortOrder: 30,
      permissions: [
        'cloudflare-dns:view',
        'cloudflare-dns:edit_records',
        'cloudflare-dns:admin_zones',
        'cloudflare-dns:manage_acls'
      ]
    },
    {
      key: 'module-admin',
      label: 'Module admin',
      description: 'Full control inklusive organisationens Cloudflare-token.',
      sortOrder: 40,
      permissions: [
        'cloudflare-dns:view',
        'cloudflare-dns:edit_records',
        'cloudflare-dns:admin_zones',
        'cloudflare-dns:manage_acls',
        'cloudflare-dns:manage_org_config'
      ]
    }
  ],
  roleDefaults: [
    { appRoleKey: 'owner', moduleRoleKey: 'module-admin' },
    { appRoleKey: 'admin', moduleRoleKey: 'module-admin' },
    { appRoleKey: 'operator', moduleRoleKey: 'zone-admin' },
    { appRoleKey: 'member', moduleRoleKey: 'viewer' },
    { appRoleKey: 'viewer', moduleRoleKey: 'viewer' }
  ]
}

export default manifest


