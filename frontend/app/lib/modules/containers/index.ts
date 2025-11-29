import type { ModuleDefinition } from '~/constants/modules'

/**
 * Containers Module
 * Manages Incus containers
 */
export const containersModule: ModuleDefinition = {
  id: 'containers',
  name: 'Containers',
  description: 'Starta, stoppa och övervaka Incus containers.',
  category: 'infrastructure',
  permissions: ['containers:read', 'containers:write'],
  routePath: '/containers',
  icon: 'mdi:docker',
  badge: 'Incus'
}

