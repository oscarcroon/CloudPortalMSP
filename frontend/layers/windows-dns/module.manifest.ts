import { definePluginManifest } from '../_shared/module-manifest'

const manifest = definePluginManifest({
  module: {
    key: 'windows-dns',
    name: 'DNS',
    description: 'Manage DNS zones, records, and ownership.',
    category: 'dns',
    icon: 'mdi:globe'
  },
  permissions: [
    { key: 'windows-dns:view', description: 'View Windows DNS zones and records.' },
    { key: 'windows-dns:zones:create', description: 'Create new DNS zones.' },
    { key: 'windows-dns:zones:write', description: 'Modify existing DNS zones.' },
    { key: 'windows-dns:records:write', description: 'Create or update DNS records.' },
    { key: 'windows-dns:ownership:read', description: 'View zone ownership mappings.' },
    { key: 'windows-dns:ownership:write', description: 'Manage zone ownership mappings.' },
    { key: 'windows-dns:autodiscover:read', description: 'Run autodiscover to find matching zones.' },
    { key: 'windows-dns:manage_org_config', description: 'Manage Windows DNS connection settings for the organization.' }
  ],
  rbacDefaults: {
    owner: [
      'windows-dns:view',
      'windows-dns:zones:create',
      'windows-dns:zones:write',
      'windows-dns:records:write',
      'windows-dns:ownership:read',
      'windows-dns:ownership:write',
      'windows-dns:autodiscover:read',
      'windows-dns:manage_org_config'
    ],
    admin: [
      'windows-dns:view',
      'windows-dns:zones:create',
      'windows-dns:zones:write',
      'windows-dns:records:write',
      'windows-dns:ownership:read',
      'windows-dns:ownership:write',
      'windows-dns:autodiscover:read',
      'windows-dns:manage_org_config'
    ],
    operator: [
      'windows-dns:view',
      'windows-dns:zones:create',
      'windows-dns:zones:write',
      'windows-dns:records:write',
      'windows-dns:ownership:read',
      'windows-dns:autodiscover:read'
    ],
    member: ['windows-dns:view'],
    viewer: ['windows-dns:view'],
    support: ['windows-dns:view']
  }
})

export default manifest

