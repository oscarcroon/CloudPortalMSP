import { useSearchRegistry } from '~/composables/useSearchRegistry'
import { useModules } from '~/composables/useModules'
import { usePermission } from '~/composables/usePermission'
import type { SearchResult } from '~/composables/useSearchRegistry'

export default defineNuxtPlugin(() => {
  const { registerProvider } = useSearchRegistry()
  // Call composables at plugin init time (not inside search()) to avoid
  // triggering useAsyncData after components are already mounted
  const { availableModules } = useModules()
  const { hasPermission } = usePermission()

  registerProvider({
    key: 'core-modules',
    label: 'Modules',
    icon: 'mdi:puzzle',
    order: 10,
    async search(query: string): Promise<SearchResult[]> {
      const { $i18n } = useNuxtApp()
      const t = ($i18n as any).t as (key: string) => string
      const q = query.toLowerCase()
      const category = t('search.categories.modules')

      return (availableModules.value || [])
        .filter((m: any) => {
          const name = (m.name || '').toLowerCase()
          const desc = (m.description || '').toLowerCase()
          const id = (m.id || m.key || '').toLowerCase()
          return name.includes(q) || desc.includes(q) || id.includes(q)
        })
        .slice(0, 5)
        .map((m: any) => ({
          id: `module-${m.id || m.key}`,
          title: m.name || m.id,
          description: m.description || '',
          icon: m.icon || 'mdi:puzzle',
          category,
          route: m.routePath || m.rootRoute || '/',
          relevance: (m.name || '').toLowerCase().startsWith(q) ? 90 : 50
        }))
    }
  })

  registerProvider({
    key: 'core-pages',
    label: 'Pages',
    icon: 'mdi:file-document',
    order: 20,
    async search(query: string): Promise<SearchResult[]> {
      const { $i18n } = useNuxtApp()
      const t = ($i18n as any).t as (key: string) => string
      const q = query.toLowerCase()
      const category = t('search.categories.pages')

      const pages: Array<{ id: string; title: string; route: string; icon: string }> = [
        { id: 'dashboard', title: t('nav.dashboard'), route: '/', icon: 'mdi:view-dashboard' },
        { id: 'profile', title: t('topBar.profile'), route: '/profile', icon: 'mdi:account' },
        { id: 'docs', title: t('topBar.docs'), route: '/docs', icon: 'mdi:file-document' },
        { id: 'support', title: t('topBar.support'), route: '/support', icon: 'mdi:headset' }
      ]

      if (hasPermission('org:manage')) {
        pages.push(
          { id: 'settings', title: t('settings.title'), route: '/settings', icon: 'mdi:cog' },
          { id: 'members', title: t('settings.members.title'), route: '/settings/members', icon: 'mdi:account-group' }
        )
      }

      return pages
        .filter(p => p.title.toLowerCase().includes(q))
        .map(p => ({
          id: `page-${p.id}`,
          title: p.title,
          icon: p.icon,
          category,
          route: p.route,
          relevance: p.title.toLowerCase().startsWith(q) ? 80 : 40
        }))
    }
  })
})
