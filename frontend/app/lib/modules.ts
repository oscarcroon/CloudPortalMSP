import type { ModuleDefinition, ModuleId, ModuleCategory } from '~/constants/modules'

// Legacy module registry placeholder; real modules now live in Nuxt layers.
const moduleRegistry: ModuleDefinition[] = []

export const getModuleById = (moduleId: ModuleId): ModuleDefinition | undefined => {
  return moduleRegistry.find((module) => module.id === moduleId)
}

export const getAllModules = (): ModuleDefinition[] => {
  return moduleRegistry
}

export const getModulesByCategory = (category: ModuleCategory): ModuleDefinition[] => {
  return moduleRegistry.filter((module) => module.category === category)
}

