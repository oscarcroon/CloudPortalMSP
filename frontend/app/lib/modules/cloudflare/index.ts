import type { ModuleDefinition } from '~/constants/modules'

/**
 * Cloudflare DNS Module
 * Manages DNS zones and records via Cloudflare API
 */
export const cloudflareModule: ModuleDefinition = {
  id: 'cloudflare',
  name: 'DNS',
  description: 'Hantera Cloudflare-zoner och DNS-poster.',
  category: 'dns',
  permissions: ['cloudflare:read', 'cloudflare:write'],
  routePath: '/dns',
  icon: 'mdi:web',
  badge: 'Cloudflare',
  visibilityMode: 'moduleRoles',
  roles: [
    {
      key: 'dns-admin',
      label: 'DNS Administratör',
      description: 'Full kontroll över DNS-zoner och poster.',
      capabilities: { read: true, write: true, manage: true }
    },
    {
      key: 'dns-reader',
      label: 'DNS Reader',
      description: 'Kan läsa DNS-zoner och poster.',
      capabilities: { read: true }
    }
  ],
  defaultAllowedRoles: ['dns-admin', 'dns-reader']
}

