import { computed, useState } from '#imports'
import type { ModuleId } from '~/constants/modules'
import { useAuth } from './useAuth'
import { useModules, type VisibleModule } from './useModules'

const dedupeModuleIds = (ids: ModuleId[]): ModuleId[] => {
  const seen = new Set<ModuleId>()
  const result: ModuleId[] = []
  for (const id of ids) {
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(id)
  }
  return result
}

export const useFavorites = () => {
  const auth = useAuth()
  // Use useModules instead of useAvailableModules to get all visible modules
  // Module visibility/access is already handled by backend via effectiveEnabled/effectiveDisabled
  // Using useAvailableModules incorrectly filtered out modules based on frontend permission checks
  // that don't include module-specific permissions (like cloudflare-dns:view)
  const { modules } = useModules()
  const pending = useState('favorite-modules-pending', () => false)

  const favoriteIds = computed<ModuleId[]>(() => auth.state.value.data?.favoriteModules ?? [])

  const availableModuleMap = computed(() => {
    const map = new Map<string, VisibleModule>()
    for (const module of modules.value) {
      map.set(module.key, module)
    }
    return map
  })

  const favoriteModules = computed(() => {
    return favoriteIds.value
      .map((id) => availableModuleMap.value.get(id))
      .filter((module): module is VisibleModule => Boolean(module))
  })

  const nonFavoriteModules = computed(() => {
    return modules.value.filter(
      (module: any) => !favoriteIds.value.includes(module.key as ModuleId)
    )
  })

  const updateLocalState = (next: ModuleId[]) => {
    if (auth.state.value.data) {
      auth.state.value.data.favoriteModules = next
    }
  }

  const saveFavorites = async (ids: ModuleId[]) => {
    const previous = favoriteIds.value.slice()
    const normalized = dedupeModuleIds(ids)
    updateLocalState(normalized)

    if (import.meta.server) {
      return normalized
    }

    pending.value = true
    try {
      const response = await ($fetch as any)(
        '/api/profile/favorites/modules',
        {
          method: 'PUT',
          body: { modules: normalized },
          credentials: 'include'
        }
      ) as { favoriteModules: ModuleId[] }
      updateLocalState(response.favoriteModules)
      return response.favoriteModules
    } catch (error) {
      updateLocalState(previous)
      throw error
    } finally {
      pending.value = false
    }
  }

  const toggleFavorite = async (moduleId: string) => {
    const normalized = moduleId as ModuleId
    const next = favoriteIds.value.includes(normalized)
      ? favoriteIds.value.filter((id) => id !== normalized)
      : [...favoriteIds.value, normalized]

    await saveFavorites(next)
  }

  const isFavorite = (moduleId: string) => favoriteIds.value.includes(moduleId as ModuleId)

  const refreshFavorites = async () => {
    if (import.meta.server) {
      return favoriteIds.value
    }
    pending.value = true
    try {
      const response = await ($fetch as any)(
        '/api/profile/favorites/modules',
        {
          credentials: 'include'
        }
      ) as { favoriteModules: ModuleId[] }
      updateLocalState(response.favoriteModules)
      return response.favoriteModules
    } finally {
      pending.value = false
    }
  }

  return {
    favoriteIds,
    favoriteModules,
    nonFavoriteModules,
    pending,
    isFavorite,
    saveFavorites,
    toggleFavorite,
    refreshFavorites
  }
}


