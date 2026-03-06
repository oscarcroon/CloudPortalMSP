import { useSearchRegistry } from '~/composables/useSearchRegistry'
import { useModules } from '~/composables/useModules'
import { usePermission } from '~/composables/usePermission'
import { useAuth } from '~/composables/useAuth'
import type { SearchResult } from '~/composables/useSearchRegistry'

export default defineNuxtPlugin(() => {
  const { registerProvider } = useSearchRegistry()
  // Call composables at plugin init time (not inside search()) to avoid
  // triggering useAsyncData after components are already mounted
  const { availableModules } = useModules()
  const { hasPermission } = usePermission()
  const auth = useAuth()

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

      const pages: Array<{ id: string; title: string; route: string; icon: string; description?: string }> = [
        { id: 'dashboard', title: t('nav.dashboard'), route: '/', icon: 'mdi:view-dashboard' },
        { id: 'profile', title: t('topBar.profile'), route: '/profile', icon: 'mdi:account' },
        { id: 'docs', title: t('topBar.docs'), route: '/docs', icon: 'mdi:file-document' },
        { id: 'support', title: t('topBar.support'), route: '/support', icon: 'mdi:headset' }
      ]

      if (hasPermission('org:manage')) {
        const settingsDesc = t('settings.title')
        pages.push(
          { id: 'settings', title: t('settings.title'), route: '/settings', icon: 'mdi:cog' },
          { id: 'members', title: t('settings.members.title'), route: '/settings/members', icon: 'mdi:account-group', description: settingsDesc },
          { id: 'settings-auth', title: t('settings.auth.title'), route: '/settings/auth', icon: 'mdi:shield-lock-outline', description: settingsDesc },
          { id: 'settings-email', title: t('settings.email.title'), route: '/settings/email', icon: 'mdi:email-outline', description: settingsDesc },
          { id: 'settings-branding', title: t('settings.branding.title'), route: '/settings/branding', icon: 'mdi:palette-outline', description: settingsDesc },
          { id: 'settings-domain', title: t('settings.customDomain.title'), route: '/settings/domain', icon: 'mdi:web', description: settingsDesc },
          { id: 'settings-modules', title: t('settings.modules.title'), route: '/settings/modules', icon: 'mdi:puzzle-outline', description: settingsDesc },
          { id: 'settings-audit', title: t('settings.audit.title'), route: '/settings/audit', icon: 'mdi:file-document-outline', description: settingsDesc },
          { id: 'settings-api-tokens', title: t('settings.apiTokens.title'), route: '/settings/api-tokens', icon: 'mdi:key-outline', description: settingsDesc },
          { id: 'settings-operations', title: t('settings.operations.title'), route: '/settings/operations', icon: 'mdi:bell-outline', description: settingsDesc }
        )
      }

      const hasTenantAccess = auth.isSuperAdmin.value || Object.keys(auth.tenantRoles.value ?? {}).length > 0
      if (hasTenantAccess) {
        const tenantDesc = t('admin.tenantAdmin.label')
        const tenantId = auth.currentTenant.value?.id

        pages.push(
          { id: 'tenant-admin', title: t('admin.tenantAdmin.title'), route: '/tenant-admin', icon: 'mdi:shield-crown', description: tenantDesc },
          { id: 'tenant-tree', title: t('admin.tenantAdmin.overview.viewTenantTree'), route: '/tenant-admin/tenants', icon: 'mdi:sitemap', description: tenantDesc },
          { id: 'tenant-operations', title: t('admin.tenantAdmin.operations.title'), route: '/tenant-admin/operations/incidents', icon: 'mdi:bell-ring-outline', description: tenantDesc }
        )

        if (tenantId) {
          pages.push(
            { id: 'tenant-members', title: t('admin.tenantAdmin.tenantActions.members'), route: `/tenant-admin/tenants/${tenantId}/members`, icon: 'mdi:account-group', description: tenantDesc },
            { id: 'tenant-email', title: t('admin.tenantAdmin.tenantActions.email'), route: `/tenant-admin/tenants/${tenantId}/email`, icon: 'mdi:email-outline', description: tenantDesc },
            { id: 'tenant-branding', title: t('admin.tenantAdmin.tenantActions.branding'), route: `/tenant-admin/tenants/${tenantId}/branding`, icon: 'mdi:palette-outline', description: tenantDesc },
            { id: 'tenant-domain', title: t('admin.tenantAdmin.tenantActions.customDomain'), route: `/tenant-admin/tenants/${tenantId}/domain`, icon: 'mdi:web', description: tenantDesc },
            { id: 'tenant-audit', title: t('admin.tenantAdmin.tenantActions.auditLogs'), route: `/tenant-admin/tenants/${tenantId}/audit-logs`, icon: 'mdi:file-document-outline', description: tenantDesc },
            { id: 'tenant-modules', title: t('admin.tenantAdmin.tenantActions.modules'), route: `/tenant-admin/tenants/${tenantId}/modules`, icon: 'mdi:puzzle-outline', description: tenantDesc }
          )
        }
      }

      return pages
        .filter(p => p.title.toLowerCase().includes(q))
        .map(p => ({
          id: `page-${p.id}`,
          title: p.title,
          description: p.description,
          icon: p.icon,
          category,
          route: p.route,
          relevance: p.title.toLowerCase().startsWith(q) ? 80 : 40
        }))
    }
  })
})
