import { useSearchRegistry } from '~/composables/useSearchRegistry'
import type { SearchResult } from '~/composables/useSearchRegistry'

export default defineNuxtPlugin(() => {
  const { registerProvider } = useSearchRegistry()
  const { t } = useNuxtApp().$i18n as { t: (key: string) => string }

  registerProvider({
    key: 'windows-dns-zones',
    label: 'Windows DNS',
    icon: 'mdi:dns',
    moduleKey: 'windows-dns',
    order: 51,
    async search(query, context): Promise<SearchResult[]> {
      try {
        const q = query.toLowerCase()
        const category = t('windowsDns.title')
        const response = await ($fetch as any)(
          '/api/dns/windows/zones',
          { credentials: 'include' }
        ) as { zones: Array<{ id: string; zoneName: string; serverName?: string }> }

        return (response.zones || [])
          .filter(z => z.zoneName.toLowerCase().includes(q))
          .slice(0, context.limit ?? 5)
          .map(z => ({
            id: `win-zone-${z.id}`,
            title: z.zoneName,
            description: z.serverName ? `Server: ${z.serverName}` : undefined,
            icon: 'mdi:dns',
            category,
            route: `/dns/${z.id}`,
            relevance: z.zoneName.toLowerCase().startsWith(q) ? 70 : 30
          }))
      } catch {
        return []
      }
    }
  })
})
