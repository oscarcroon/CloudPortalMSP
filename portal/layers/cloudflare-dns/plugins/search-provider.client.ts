import { useSearchRegistry } from '~/composables/useSearchRegistry'
import type { SearchResult } from '~/composables/useSearchRegistry'

export default defineNuxtPlugin(() => {
  const { registerProvider } = useSearchRegistry()
  const { t } = useNuxtApp().$i18n as { t: (key: string) => string }

  registerProvider({
    key: 'cloudflare-dns-zones',
    label: 'Cloudflare DNS',
    icon: 'mdi:cloud',
    moduleKey: 'cloudflare-dns',
    order: 50,
    async search(query, context): Promise<SearchResult[]> {
      try {
        const q = query.toLowerCase()
        const category = t('cloudflareDns.title')
        const response = await $fetch<{ zones: Array<{ id: string; name: string; status: string | null }> }>(
          '/api/dns/cloudflare/zones',
          { credentials: 'include' }
        )

        return (response.zones || [])
          .filter(z => z.name.toLowerCase().includes(q))
          .slice(0, context.limit ?? 5)
          .map(z => ({
            id: `cf-zone-${z.id}`,
            title: z.name,
            description: z.status ? `Status: ${z.status}` : undefined,
            icon: 'mdi:cloud',
            category,
            route: `/cloudflare-dns/${z.id}`,
            relevance: z.name.toLowerCase().startsWith(q) ? 70 : 30
          }))
      } catch {
        return []
      }
    }
  })
})
