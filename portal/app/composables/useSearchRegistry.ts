import { shallowRef } from '#imports'

export interface SearchProvider {
  key: string
  label: string
  icon?: string
  moduleKey?: string
  order?: number
  search(query: string, context: SearchContext): Promise<SearchResult[]>
}

export interface SearchResult {
  id: string
  title: string
  description?: string
  icon?: string
  category: string
  route: string
  relevance?: number
}

export interface SearchContext {
  orgId: string
  locale: string
  limit?: number
}

// Module-scoped ref — not useState, because providers contain functions
// that cannot be serialized during SSR hydration.
const providers = shallowRef<SearchProvider[]>([])

export const useSearchRegistry = () => {
  const registerProvider = (provider: SearchProvider) => {
    const current = providers.value
    const idx = current.findIndex((p: SearchProvider) => p.key === provider.key)
    if (idx !== -1) {
      const copy = [...current]
      copy[idx] = provider
      providers.value = copy
    } else {
      providers.value = [...current, provider]
    }
  }

  return {
    providers,
    registerProvider
  }
}
