import { cloudflareModule } from './cloudflare'
import { containersModule } from './containers'
import { vmsModule } from './vms'
import { wordpressModule } from './wordpress'
import { ncentralModule } from './ncentral'
import { monitoringModule } from './monitoring'
import { managedServerModule } from './managed-server'
import type { ModuleDefinition, ModuleId } from '~/constants/modules'

/**
 * Central module registry
 * All modules must be registered here to appear in the system
 */
export const moduleRegistry: ModuleDefinition[] = [
  cloudflareModule,
  containersModule,
  vmsModule,
  wordpressModule,
  ncentralModule,
  monitoringModule,
  managedServerModule
]

/**
 * Get a module by its ID
 */
export const getModuleById = (moduleId: ModuleId): ModuleDefinition | undefined => {
  return moduleRegistry.find(m => m.id === moduleId)
}

/**
 * Get all modules
 */
export const getAllModules = (): ModuleDefinition[] => {
  return moduleRegistry
}

/**
 * Get modules by category
 */
export const getModulesByCategory = (category: ModuleDefinition['category']): ModuleDefinition[] => {
  return moduleRegistry.filter(m => m.category === category)
}

