/**
 * Simple cache for entity names used in breadcrumbs.
 * Pages should call setName() when they load entity data.
 * Breadcrumbs read from this cache via getName().
 */
import { ref } from 'vue'

type EntityType = 'tenant' | 'organization' | 'zone' | 'user' | 'group'

interface EntityCache {
  [type: string]: {
    [id: string]: string
  }
}

const cache = ref<EntityCache>({})

export const useEntityNames = () => {
  /**
   * Set a name for an entity. Called by pages when they load data.
   */
  const setName = (type: EntityType, id: string, name: string) => {
    if (!cache.value[type]) {
      cache.value[type] = {}
    }
    cache.value[type][id] = name
  }

  /**
   * Get a cached name for an entity. Returns undefined if not cached.
   */
  const getName = (type: EntityType, id: string): string | undefined => {
    return cache.value[type]?.[id]
  }

  /**
   * Bulk set names (e.g., from a list response)
   */
  const setNames = (type: EntityType, items: Array<{ id: string; name: string }>) => {
    if (!cache.value[type]) {
      cache.value[type] = {}
    }
    for (const item of items) {
      cache.value[type][item.id] = item.name
    }
  }

  /**
   * Clear cache for a type or all
   */
  const clear = (type?: EntityType) => {
    if (type) {
      delete cache.value[type]
    } else {
      cache.value = {}
    }
  }

  return {
    setName,
    getName,
    setNames,
    clear
  }
}

