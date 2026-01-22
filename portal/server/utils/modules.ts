import type { ModuleId } from '~/constants/modules'
import { moduleIds } from '~/constants/modules'

const moduleIdSet = new Set<ModuleId>(Array.from(moduleIds) as ModuleId[])

export const isValidModuleId = (value: unknown): value is ModuleId => {
  if (typeof value !== 'string') {
    return false
  }
  return moduleIdSet.has(value as ModuleId)
}

export const sanitizeModuleIdList = (
  values: string[],
  options?: { max?: number }
): ModuleId[] => {
  const max = options?.max ?? moduleIds.length
  const deduped: ModuleId[] = []

  for (const raw of values) {
    if (deduped.length >= max) {
      break
    }
    if (!isValidModuleId(raw)) {
      continue
    }
    const moduleId = raw as ModuleId
    if (deduped.includes(moduleId)) {
      continue
    }
    deduped.push(moduleId)
  }

  return deduped
}

