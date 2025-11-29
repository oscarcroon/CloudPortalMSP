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
  badge: 'Cloudflare'
}

