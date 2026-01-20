import { definePluginManifest } from '../_shared/module-manifest'

const manifest = definePluginManifest({
  module: {
    key: 'windows-dns',
    name: 'DNS',
    description: 'Manage DNS zones, records, ownership, and redirects.',
    category: 'dns',
    icon: 'mdi:globe'
  },
  permissions: [
    // DNS core permissions
    { key: 'windows-dns:view', description: 'View DNS zones and records.' },
    { key: 'windows-dns:zones:create', description: 'Create new DNS zones.' },
    { key: 'windows-dns:zones:write', description: 'Modify existing DNS zones.' },
    { key: 'windows-dns:records:write', description: 'Create or update DNS records.' },
    { key: 'windows-dns:ownership:read', description: 'View zone ownership mappings.' },
    { key: 'windows-dns:ownership:write', description: 'Manage zone ownership mappings.' },
    { key: 'windows-dns:autodiscover:read', description: 'Run autodiscover to find matching zones.' },
    { key: 'windows-dns:manage_org_config', description: 'Manage DNS connection settings for the organization.' },

    // Redirect permissions
    { key: 'windows-dns:redirects:access', description: 'Access the redirects module.' },
    { key: 'windows-dns:redirects:view', description: 'View redirect configurations.' },
    { key: 'windows-dns:redirects:create', description: 'Create new redirects.' },
    { key: 'windows-dns:redirects:edit', description: 'Edit existing redirects.' },
    { key: 'windows-dns:redirects:delete', description: 'Delete redirects.' },
    { key: 'windows-dns:redirects:import', description: 'Bulk import redirects from files.' },
    { key: 'windows-dns:redirects:export', description: 'Export redirects to files.' },
    { key: 'windows-dns:redirects:config:view', description: 'View redirect configuration.' },
    { key: 'windows-dns:redirects:config:edit', description: 'Edit redirect configuration.' },
    { key: 'windows-dns:redirects:traefik:view', description: 'View Traefik sync status.' },
    { key: 'windows-dns:redirects:traefik:sync', description: 'Trigger Traefik configuration sync.' }
  ],
  rbacDefaults: {
    owner: [
      // DNS core
      'windows-dns:view',
      'windows-dns:zones:create',
      'windows-dns:zones:write',
      'windows-dns:records:write',
      'windows-dns:ownership:read',
      'windows-dns:ownership:write',
      'windows-dns:autodiscover:read',
      'windows-dns:manage_org_config',
      // Redirects - full access
      'windows-dns:redirects:access',
      'windows-dns:redirects:view',
      'windows-dns:redirects:create',
      'windows-dns:redirects:edit',
      'windows-dns:redirects:delete',
      'windows-dns:redirects:import',
      'windows-dns:redirects:export',
      'windows-dns:redirects:config:view',
      'windows-dns:redirects:config:edit',
      'windows-dns:redirects:traefik:view',
      'windows-dns:redirects:traefik:sync'
    ],
    admin: [
      // DNS core
      'windows-dns:view',
      'windows-dns:zones:create',
      'windows-dns:zones:write',
      'windows-dns:records:write',
      'windows-dns:ownership:read',
      'windows-dns:ownership:write',
      'windows-dns:autodiscover:read',
      'windows-dns:manage_org_config',
      // Redirects - full access
      'windows-dns:redirects:access',
      'windows-dns:redirects:view',
      'windows-dns:redirects:create',
      'windows-dns:redirects:edit',
      'windows-dns:redirects:delete',
      'windows-dns:redirects:import',
      'windows-dns:redirects:export',
      'windows-dns:redirects:config:view',
      'windows-dns:redirects:config:edit',
      'windows-dns:redirects:traefik:view',
      'windows-dns:redirects:traefik:sync'
    ],
    operator: [
      // DNS core
      'windows-dns:view',
      'windows-dns:zones:create',
      'windows-dns:zones:write',
      'windows-dns:records:write',
      'windows-dns:ownership:read',
      'windows-dns:autodiscover:read',
      // Redirects - CRUD + traefik sync
      'windows-dns:redirects:access',
      'windows-dns:redirects:view',
      'windows-dns:redirects:create',
      'windows-dns:redirects:edit',
      'windows-dns:redirects:delete',
      'windows-dns:redirects:import',
      'windows-dns:redirects:export',
      'windows-dns:redirects:traefik:view',
      'windows-dns:redirects:traefik:sync'
    ],
    member: [
      'windows-dns:view',
      // Redirects - view + export only
      'windows-dns:redirects:access',
      'windows-dns:redirects:view',
      'windows-dns:redirects:export'
    ],
    viewer: [
      'windows-dns:view',
      // Redirects - view + export only
      'windows-dns:redirects:access',
      'windows-dns:redirects:view',
      'windows-dns:redirects:export'
    ],
    support: [
      'windows-dns:view',
      // Redirects - view only
      'windows-dns:redirects:access',
      'windows-dns:redirects:view'
    ]
  }
})

export default manifest

