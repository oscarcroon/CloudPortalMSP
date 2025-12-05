import type { ModuleDefinition } from '~/constants/modules'

/**
 * Managed Server Module
 * Dedicated and managed servers
 */
export const managedServerModule: ModuleDefinition = {
  id: 'managed-server',
  name: 'Managed server',
  description: 'Få koll på dedikerade eller managed servrar.',
  category: 'infrastructure',
  permissions: ['org:read'],
  routePath: '/managed-server',
  icon: 'mdi:server-network',
  badge: 'Managed'
}

