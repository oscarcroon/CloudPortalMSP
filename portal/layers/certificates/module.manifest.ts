import { definePluginManifest } from '../_shared/module-manifest'

const manifest = definePluginManifest({
  module: {
    key: 'certificates',
    name: 'Certificates',
    description: 'SSL/TLS certificate ordering, inventory, and automated renewal via ACME.',
    category: 'security',
    icon: 'mdi:certificate-outline'
  },
  permissions: [
    { key: 'certificates:view', description: 'View certificates, orders, agents, and credential sets.' },
    { key: 'certificates:order', description: 'Create and manage certificate orders.' },
    { key: 'certificates:manage_agents', description: 'Register, update, and deactivate certificate agents.' },
    { key: 'certificates:manage_credentials', description: 'Create, update, and rotate ACME credential sets.' },
    { key: 'certificates:admin', description: 'Full administrative access to the certificates module.' }
  ],
  apiScopes: [
    { key: 'certificates:read', description: 'Read certificates, orders, agents, and credential sets.' },
    { key: 'certificates:write', description: 'Create and manage certificate orders, agents, and credentials.' }
  ],
  healthCheck: {
    endpoint: '/api/certificates/health',
    label: 'Certificates'
  },
  rbacDefaults: {
    owner: [
      'certificates:view',
      'certificates:order',
      'certificates:manage_agents',
      'certificates:manage_credentials',
      'certificates:admin'
    ],
    admin: [
      'certificates:view',
      'certificates:order',
      'certificates:manage_agents',
      'certificates:manage_credentials',
      'certificates:admin'
    ],
    operator: [
      'certificates:view',
      'certificates:order',
      'certificates:manage_agents'
    ],
    member: ['certificates:view'],
    viewer: ['certificates:view'],
    support: ['certificates:view']
  }
})

export default manifest
