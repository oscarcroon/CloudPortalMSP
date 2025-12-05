import type { ModuleDefinition } from '~/constants/modules'

/**
 * Monitoring Module
 * Observability and alerting
 */
export const monitoringModule: ModuleDefinition = {
  id: 'monitoring',
  name: 'Övervakning',
  description: 'Fånga upp alerts och status från observability stacken.',
  category: 'monitoring',
  permissions: ['org:read'],
  routePath: '/monitoring',
  icon: 'mdi:chart-line-variant',
  badge: 'Monitoring'
}

