import {
  ALL_MODULES,
  type ModuleMeta,
  type ModuleScope,
  type ModuleStatus
} from './module-registry'
import type {
  ModuleCategory,
  ModuleDefinition,
  ModuleId
} from '~/constants/modules'

export type ModuleWithStatus = ModuleDefinition & { status: ModuleStatus }

const metaToDefinition = (meta: ModuleMeta): ModuleDefinition => ({
  ...meta,
  id: meta.key as ModuleId,
  permissions: meta.requiredPermissions,
  routePath: meta.rootRoute
})

const metaToDefinitionWithStatus = (meta: ModuleMeta): ModuleWithStatus => ({
  ...metaToDefinition(meta),
  status: meta.status ?? 'active'
})

export const getAllModules = (): ModuleWithStatus[] => ALL_MODULES.map(metaToDefinitionWithStatus)

export const getModulesByScope = (scope: ModuleScope): ModuleWithStatus[] =>
  ALL_MODULES.filter((module) => module.scopes.includes(scope)).map(metaToDefinitionWithStatus)

export const getModuleByKey = (key: string): ModuleWithStatus | undefined => {
  const meta = ALL_MODULES.find((module) => module.key === key)
  return meta ? metaToDefinitionWithStatus(meta) : undefined
}

export const getModulesByCategory = (category: ModuleCategory): ModuleWithStatus[] =>
  ALL_MODULES.filter((module) => module.category === category).map(metaToDefinitionWithStatus)

export const filterModulesByFeatureFlags = (
  modules: ModuleWithStatus[],
  featureFlags: Record<string, boolean | undefined>
): ModuleWithStatus[] => {
  return modules.filter((module) => {
    if (!module.featureFlag) {
      return true
    }
    return Boolean(featureFlags[module.featureFlag])
  })
}

export const pruneUnknownModuleKeys = <T extends { moduleId?: string; moduleKey?: string }>(
  items: T[]
): T[] => {
  const knownKeys = new Set(ALL_MODULES.map((module) => module.key))
  return items.filter((item) => {
    const key = (item.moduleKey ?? item.moduleId) as string | undefined
    return key ? knownKeys.has(key) : false
  })
}

