import type { ModuleDefinition } from '~/constants/modules'

/**
 * Virtual Machines Module
 * Manages ESXi/Morpheus VMs
 */
export const vmsModule: ModuleDefinition = {
  id: 'vms',
  name: 'Virtuella maskiner',
  description: 'Kontrollera ESXi/Morpheus VMs via ett förenklat gränssnitt.',
  category: 'infrastructure',
  permissions: ['vms:read', 'vms:write'],
  routePath: '/vms',
  icon: 'mdi:server',
  badge: 'ESXi / Morpheus'
}

