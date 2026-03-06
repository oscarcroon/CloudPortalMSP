import { computed, watch, useState } from '#imports'
import { useSearchRegistry } from './useSearchRegistry'
import { useAuth } from './useAuth'
import type { SearchProvider, SearchResult } from './useSearchRegistry'

let watcherInstalled = false

export const useGlobalSearch = () => {
  const { providers } = useSearchRegistry()
  const auth = useAuth()

  const query = useState<string>('global-search-query', () => '')
  const isOpen = useState<boolean>('global-search-open', () => false)
  const loading = useState<boolean>('global-search-loading', () => false)
  const results = useState<SearchResult[]>('global-search-results', () => [])
  const selectedIndex = useState<number>('global-search-index', () => 0)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // All registered providers are active. RBAC is handled at two levels:
  // 1. Layer plugins only register if their module is available (client-only plugins)
  // 2. Each provider's search() calls authenticated APIs that enforce access server-side
  const activeProviders = computed(() => {
    return [...providers.value]
      .sort((a: SearchProvider, b: SearchProvider) => (a.order ?? 100) - (b.order ?? 100))
  })

  const groupedResults = computed(() => {
    const groups: Record<string, SearchResult[]> = {}
    for (const result of results.value) {
      if (!groups[result.category]) {
        groups[result.category] = []
      }
      groups[result.category]!.push(result)
    }
    return groups
  })

  const flatResults = computed(() => results.value)

  const runSearch = async (q: string) => {
    if (!q.trim()) {
      results.value = []
      loading.value = false
      return
    }

    loading.value = true
    const orgId = auth.currentOrg.value?.id || ''
    const locale = 'en'

    try {
      const settled = await Promise.allSettled(
        activeProviders.value.map((p: SearchProvider) =>
          p.search(q.trim(), { orgId, locale, limit: 5 })
        )
      )

      const allResults: SearchResult[] = []
      for (const result of settled) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allResults.push(...result.value)
        }
      }

      allResults.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
      results.value = allResults
    } catch {
      results.value = []
    } finally {
      loading.value = false
    }
  }

  if (!watcherInstalled && import.meta.client) {
    watcherInstalled = true
    watch(query, (newQuery) => {
      if (debounceTimer) clearTimeout(debounceTimer)
      selectedIndex.value = 0

      if (!newQuery.trim()) {
        results.value = []
        loading.value = false
        return
      }

      loading.value = true
      debounceTimer = setTimeout(() => {
        runSearch(newQuery)
      }, 250)
    })
  }

  const open = () => {
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
    selectedIndex.value = 0
  }

  const selectNext = () => {
    if (flatResults.value.length === 0) return
    selectedIndex.value = (selectedIndex.value + 1) % flatResults.value.length
  }

  const selectPrev = () => {
    if (flatResults.value.length === 0) return
    selectedIndex.value = (selectedIndex.value - 1 + flatResults.value.length) % flatResults.value.length
  }

  const selectedResult = computed(() => {
    return flatResults.value[selectedIndex.value] ?? null
  })

  return {
    query,
    results,
    groupedResults,
    flatResults,
    loading,
    isOpen,
    selectedIndex,
    selectedResult,
    open,
    close,
    selectNext,
    selectPrev
  }
}
