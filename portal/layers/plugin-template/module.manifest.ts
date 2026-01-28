import { definePluginManifest } from '../_shared/module-manifest'

const manifest = definePluginManifest({
  module: {
    key: 'example-module',
    name: 'Example Module',
    description: 'Starter template that demonstrates how to build a plugin with core Tailwind.',
    category: 'examples'
  },
  permissions: [
    { key: 'example:read', description: 'Read example resources' },
    { key: 'example:write', description: 'Create or update example resources' }
  ],
  roles: [
    {
      key: 'viewer',
      label: 'Viewer',
      description: 'Can read example resources.',
      sortOrder: 10,
      permissions: ['example:read']
    },
    {
      key: 'editor',
      label: 'Editor',
      description: 'Can read and modify example resources.',
      sortOrder: 20,
      permissions: ['example:read', 'example:write']
    }
  ],
  roleDefaults: [
    { appRoleKey: 'owner', moduleRoleKey: 'editor' },
    { appRoleKey: 'admin', moduleRoleKey: 'editor' },
    { appRoleKey: 'operator', moduleRoleKey: 'editor' },
    { appRoleKey: 'member', moduleRoleKey: 'viewer' },
    { appRoleKey: 'viewer', moduleRoleKey: 'viewer' }
  ]
})

export default manifest


