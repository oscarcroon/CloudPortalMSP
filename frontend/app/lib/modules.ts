import type {
  ModuleCategory,
  ModuleDefinition,
  ModuleId,
  ModuleScope
} from '~/constants/modules'
import { ALL_MODULES, type ModuleMeta } from './module-registry'

const metaToDefinition = (meta: ModuleMeta): ModuleDefinition => ({
  ...meta,
  id: meta.key as ModuleId,
  permissions: meta.requiredPermissions,
  routePath: meta.rootRoute
})

// Centralized registry (derived from ALL_MODULES to keep legacy helpers)
const moduleRegistry: ModuleDefinition[] = ALL_MODULES.map(metaToDefinition)

export const getModuleById = (moduleId: ModuleId): ModuleDefinition | undefined => {
  return moduleRegistry.find((module) => module.id === moduleId)
}

export const getAllModules = (): ModuleDefinition[] => {
  return moduleRegistry
}

export const getModulesByCategory = (category: ModuleCategory): ModuleDefinition[] => {
  return moduleRegistry.filter((module) => module.category === category)
}

export const getModulesByScope = (scope: ModuleScope): ModuleDefinition[] => {
  return moduleRegistry.filter((module) => module.scopes.includes(scope))
}

export const getModuleMetaByKey = (key: string): ModuleMeta | undefined =>
  ALL_MODULES.find((module) => module.key === key)

export const toModuleDefinition = metaToDefinition

