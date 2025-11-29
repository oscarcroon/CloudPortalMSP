import type { ModuleDefinition } from '~/constants/modules'

/**
 * WordPress Module
 * Manages WordPress sites, updates, and backups
 */
export const wordpressModule: ModuleDefinition = {
  id: 'wordpress',
  name: 'WordPress',
  description: 'Överblick över dina sajter, status, uppdateringar och backuper.',
  category: 'cms',
  permissions: ['wordpress:read', 'wordpress:write'],
  routePath: '/wordpress',
  icon: 'mdi:wordpress',
  badge: 'WordPress'
}

