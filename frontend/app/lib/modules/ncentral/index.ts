import type { ModuleDefinition } from '~/constants/modules'

/**
 * nCentral Module
 * RMM platform integration
 */
export const ncentralModule: ModuleDefinition = {
  id: 'ncentral',
  name: 'nCentral',
  description: 'Se agenter och servrar som körs i RMM-plattformen.',
  category: 'rmm',
  permissions: ['org:read'],
  routePath: '/ncentral',
  icon: 'mdi:server-network',
  badge: 'nCentral'
}

