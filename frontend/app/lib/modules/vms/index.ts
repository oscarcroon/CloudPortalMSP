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
  badge: 'ESXi / Morpheus',
  visibilityMode: 'moduleRoles',
  roles: [
    {
      key: 'vms-admin',
      label: 'VMs Administratör',
      description: 'Full kontroll över virtuella servrar.',
      capabilities: { read: true, write: true, manage: true }
    },
    {
      key: 'vms-reader',
      label: 'VMs Reader',
      description: 'Kan läsa status och detaljer för virtuella servrar.',
      capabilities: { read: true }
    }
  ],
  defaultAllowedRoles: ['vms-admin', 'vms-reader']
}

