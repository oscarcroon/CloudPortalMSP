import type { PluginModuleManifest } from '@/server/lib/plugin-registry/types'

const manifest: PluginModuleManifest = {
  module: {
    key: 'windows-dns',
    name: 'Windows DNS',
    description: 'Manage Windows DNS zones and records.',
    category: 'infrastructure'
  },
  permissions: [
    { key: 'dns:windows:read', description: 'Read DNS zones and records' },
    { key: 'dns:windows:write', description: 'Modify DNS records' },
    { key: 'dns:windows:admin', description: 'Manage zones and advanced settings' }
  ],
  roles: [
    {
      key: 'viewer',
      label: 'Viewer',
      description: 'Can view DNS zones and records.',
      sortOrder: 10,
      permissions: ['dns:windows:read']
    },
    {
      key: 'editor',
      label: 'Editor',
      description: 'Can modify DNS records.',
      sortOrder: 20,
      permissions: ['dns:windows:read', 'dns:windows:write']
    },
    {
      key: 'admin',
      label: 'Admin',
      description: 'Full control over Windows DNS.',
      sortOrder: 30,
      permissions: ['dns:windows:read', 'dns:windows:write', 'dns:windows:admin']
    }
  ],
  roleDefaults: [
    { appRoleKey: 'owner', moduleRoleKey: 'admin' },
    { appRoleKey: 'admin', moduleRoleKey: 'admin' },
    { appRoleKey: 'operator', moduleRoleKey: 'editor' },
    { appRoleKey: 'member', moduleRoleKey: 'viewer' },
    { appRoleKey: 'viewer', moduleRoleKey: 'viewer' }
  ]
}

export default manifest

