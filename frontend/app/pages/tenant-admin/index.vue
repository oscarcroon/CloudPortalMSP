<template>
  <section class="space-y-8">
    <!-- Top Bar -->
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {{ t('admin.tenantAdmin.label') }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {{ t('admin.tenantAdmin.title') }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ t('admin.tenantAdmin.subtitle') }}
        </p>
      </div>
      <div v-if="isSuperAdmin" class="flex flex-wrap items-center gap-3">
        <!-- Superadmin link -->
        <NuxtLink
          to="/platform-admin"
          class="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-100 dark:border-purple-500/50 dark:bg-purple-500/20 dark:text-purple-300 dark:hover:bg-purple-500/30"
        >
          <Icon icon="mdi:shield-crown" class="h-4 w-4" />
          {{ t('admin.tenantAdmin.platformAdmin') }}
        </NuxtLink>
      </div>
    </header>

    <!-- Main Grid -->
    <div class="grid gap-6 lg:grid-cols-12">
      <!-- Left Column (8 cols) -->
      <div class="space-y-6 lg:col-span-8">
        <!-- Tenant Overview Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <!-- Has tenant -->
          <div v-if="currentTenant" class="space-y-4">
            <!-- Tenant name and info -->
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-4">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl" :class="tenantTypeColor">
                  <Icon :icon="tenantTypeIcon" class="h-6 w-6" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">{{ currentTenant.name }}</h2>
                  <div class="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span class="capitalize">{{ currentTenant.type }}</span>
                    <span class="font-mono text-xs">{{ currentTenant.id.substring(0, 12) }}…</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <NuxtLink
                  :to="`/tenant-admin/tenants/${currentTenant.id}`"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Icon icon="mdi:open-in-new" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.overview.viewDetails') }}
                </NuxtLink>
                <NuxtLink
                  to="/tenant-admin/tenants"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Icon icon="mdi:sitemap" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.overview.viewTenantTree') }}
                </NuxtLink>
              </div>
            </div>

            <!-- Stats -->
            <div class="grid gap-4 sm:grid-cols-3">
              <NuxtLink
                :to="`/tenant-admin/tenants/${currentTenant.id}`"
                class="rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:border-brand/30 hover:bg-brand/5 dark:border-white/5 dark:bg-white/5 dark:hover:border-brand/30 dark:hover:bg-brand/10"
              >
                <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ organizationCount }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('admin.tenantAdmin.overview.organizations') }}</p>
              </NuxtLink>
              <NuxtLink
                :to="`/tenant-admin/tenants/${currentTenant.id}/members`"
                class="rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:border-brand/30 hover:bg-brand/5 dark:border-white/5 dark:bg-white/5 dark:hover:border-brand/30 dark:hover:bg-brand/10"
              >
                <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ memberCount ?? '—' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('admin.tenantAdmin.overview.members') }}</p>
              </NuxtLink>
              <NuxtLink
                :to="`/tenant-admin/tenants/${currentTenant.id}/modules`"
                class="rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:border-brand/30 hover:bg-brand/5 dark:border-white/5 dark:bg-white/5 dark:hover:border-brand/30 dark:hover:bg-brand/10"
              >
                <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ activeModulesCount ?? '—' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('admin.tenantAdmin.overview.modules') }}</p>
              </NuxtLink>
            </div>
          </div>

          <!-- Empty state: no tenant -->
          <div v-else class="flex flex-col items-center justify-center py-8 text-center">
            <div class="rounded-full bg-slate-100 p-4 dark:bg-white/10">
              <Icon icon="mdi:office-building-remove-outline" class="h-10 w-10 text-slate-400" />
            </div>
            <h3 class="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.emptyState.title') }}
            </h3>
            <p class="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {{ t('admin.tenantAdmin.emptyState.description') }}
            </p>
          </div>
        </div>

        <!-- Tenant Actions Card -->
        <div v-if="currentTenant" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:tools" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.tenantActions.title') }}
            </h2>
          </div>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ t('admin.tenantAdmin.tenantActions.description', { tenant: currentTenant.name }) }}
          </p>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLinkTile
              v-for="action in tenantActions"
              :key="action.to"
              :to="action.to"
              :icon="action.icon"
              :label="action.label"
              :description="action.description"
              :disabled="action.disabled"
            />
          </div>
        </div>

        <!-- Operations & News Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:bell-ring-outline" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.operations.title') }}
            </h2>
          </div>

          <!-- Tabs -->
          <div class="mt-4 flex gap-4 border-b border-slate-200 dark:border-white/10">
            <button
              class="relative pb-3 text-sm font-medium transition"
              :class="activeTab === 'incidents' ? 'text-brand' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
              @click="activeTab = 'incidents'"
            >
              {{ t('admin.tenantAdmin.operations.incidents') }}
              <span
                v-if="activeTab === 'incidents'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-brand"
              />
            </button>
            <button
              class="relative pb-3 text-sm font-medium transition"
              :class="activeTab === 'news' ? 'text-brand' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
              @click="activeTab = 'news'"
            >
              {{ t('admin.tenantAdmin.operations.news') }}
              <span
                v-if="activeTab === 'news'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-brand"
              />
            </button>
          </div>

          <!-- Tab content -->
          <div class="mt-4">
            <!-- Incidents -->
            <div v-if="activeTab === 'incidents'" class="space-y-4">
              <div class="flex flex-col items-center justify-center py-8 text-center">
                <Icon icon="mdi:check-circle-outline" class="h-10 w-10 text-emerald-500" />
                <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  {{ t('admin.tenantAdmin.operations.noIncidents') }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  disabled
                  class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-400 dark:bg-white/5 dark:text-slate-500"
                >
                  <Icon icon="mdi:plus" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.operations.createIncident') }}
                  <span class="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-white/10">{{ t('admin.tenantAdmin.comingSoon') }}</span>
                </button>
                <button
                  disabled
                  class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500"
                >
                  <Icon icon="mdi:history" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.operations.viewHistory') }}
                </button>
              </div>
            </div>

            <!-- News -->
            <div v-if="activeTab === 'news'" class="space-y-4">
              <div class="flex flex-col items-center justify-center py-8 text-center">
                <Icon icon="mdi:newspaper-variant-outline" class="h-10 w-10 text-slate-400" />
                <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  {{ t('admin.tenantAdmin.operations.noNews') }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  disabled
                  class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-400 dark:bg-white/5 dark:text-slate-500"
                >
                  <Icon icon="mdi:plus" class="h-4 w-4" />
                  {{ t('admin.tenantAdmin.operations.createNews') }}
                  <span class="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-white/10">{{ t('admin.tenantAdmin.comingSoon') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column (4 cols) -->
      <div class="space-y-6 lg:col-span-4">
        <!-- System Health Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:heart-pulse" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.health.title') }}
            </h2>
          </div>
          <div class="mt-4 space-y-3">
            <div
              v-for="integration in integrations"
              :key="integration.name"
              class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-white/5 dark:bg-white/5"
            >
              <div class="flex items-center gap-2">
                <Icon :icon="integration.icon" class="h-4 w-4 text-slate-500" />
                <span class="text-sm text-slate-700 dark:text-slate-300">{{ integration.name }}</span>
              </div>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="getStatusClass(integration.status)"
              >
                {{ integration.status }}
              </span>
            </div>
          </div>
          <p class="mt-4 text-xs text-slate-400 dark:text-slate-500">
            {{ t('admin.tenantAdmin.health.lastSync') }}: —
          </p>
        </div>

        <!-- Recent Activity Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:history" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.activity.title') }}
            </h2>
          </div>
          <div class="mt-4 flex flex-col items-center justify-center py-6 text-center">
            <Icon icon="mdi:clipboard-text-clock-outline" class="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {{ t('admin.tenantAdmin.activity.noActivity') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/audit"
            class="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <Icon icon="mdi:file-document-outline" class="h-4 w-4" />
            {{ t('admin.tenantAdmin.activity.viewAuditLog') }}
          </NuxtLink>
        </div>

        <!-- Support Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/70">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:lifebuoy" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ t('admin.tenantAdmin.support.title') }}
            </h2>
          </div>
          <div class="mt-4 space-y-2">
            <NuxtLink
              to="/docs"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <Icon icon="mdi:book-open-variant" class="h-4 w-4 text-slate-400" />
              {{ t('admin.tenantAdmin.support.documentation') }}
            </NuxtLink>
            <NuxtLink
              to="/support"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <Icon icon="mdi:headset" class="h-4 w-4 text-slate-400" />
              {{ t('admin.tenantAdmin.support.contact') }}
            </NuxtLink>
            <a
              href="https://status.coreit.se"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <Icon icon="mdi:signal-cellular-3" class="h-4 w-4 text-slate-400" />
              {{ t('admin.tenantAdmin.support.statusPage') }}
              <Icon icon="mdi:open-in-new" class="h-3 w-3 text-slate-300" />
            </a>
          </div>
          <div v-if="isSuperAdmin" class="mt-4 border-t border-slate-100 pt-4 dark:border-white/5">
            <NuxtLink
              to="/platform-admin"
              class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 transition hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-500/10"
            >
              <Icon icon="mdi:shield-crown" class="h-4 w-4" />
              {{ t('admin.tenantAdmin.platformAdmin') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n, useFetch } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import QuickLinkTile from '~/components/admin/QuickLinkTile.vue'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const auth = useAuth()

const activeTab = ref<'incidents' | 'news'>('incidents')

const currentTenant = computed(() => auth.currentTenant.value)
const isSuperAdmin = computed(() => auth.isSuperAdmin.value)
const organizationCount = computed(() => auth.organizations.value?.length ?? 0)

// Fetch tenant details for member count
const tenantId = computed(() => currentTenant.value?.id)

interface MembersResponse {
  members: { membershipId: string }[]
  invites: { id: string }[]
}

interface ModuleStatusDto {
  key: string
  tenantEnabled: boolean
  effectiveEnabled: boolean
  effectiveDisabled?: boolean
}

interface ModulesResponse {
  modules: ModuleStatusDto[]
}

const { data: membersData } = useFetch<MembersResponse>(
  () => tenantId.value ? `/api/admin/tenants/${tenantId.value}/members` : '',
  {
    immediate: !!tenantId.value,
    watch: [tenantId],
    default: () => ({ members: [], invites: [] })
  }
)

// Fetch module status for active modules count
const { data: modulesData } = useFetch<ModulesResponse>(
  () => tenantId.value ? `/api/admin/tenants/${tenantId.value}/modules` : '',
  {
    immediate: !!tenantId.value,
    watch: [tenantId],
    default: () => ({ modules: [] })
  }
)

const memberCount = computed(() => {
  return membersData.value?.members?.length ?? null
})

const activeModulesCount = computed(() => {
  if (!modulesData.value?.modules) return null
  // Count modules that are enabled at tenant level (tenantEnabled) and not disabled
  return modulesData.value.modules.filter(m => m.tenantEnabled && !m.effectiveDisabled).length
})

const tenantTypeIcon = computed(() => {
  switch (currentTenant.value?.type) {
    case 'distributor':
      return 'mdi:city'
    case 'provider':
      return 'mdi:store'
    default:
      return 'mdi:office-building-outline'
  }
})

const tenantTypeColor = computed(() => {
  switch (currentTenant.value?.type) {
    case 'distributor':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'provider':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    default:
      return 'bg-brand/10 text-brand'
  }
})

const canCreateProvider = computed(() => {
  if (!currentTenant.value) return false
  if (isSuperAdmin.value) return true
  if (currentTenant.value.type !== 'distributor') return false
  const role = auth.state.value.data?.tenantRoles[currentTenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[currentTenant.value.id] ?? false
  return role === 'admin' && includeChildren
})

const tenantActions = computed(() => {
  const tenant = currentTenant.value
  if (!tenant) return []

  const actions = []
  const tenantId = tenant.id
  const isProvider = tenant.type === 'provider'
  const isDistributor = tenant.type === 'distributor'

  // Create provider (distributor only)
  if (isDistributor && canCreateProvider.value) {
    actions.push({
      to: `/tenant-admin/tenants/${tenantId}/providers/new`,
      icon: 'mdi:store-plus',
      label: t('admin.tenantAdmin.tenantActions.createProvider'),
      description: t('admin.tenantAdmin.tenantActions.createProviderDesc'),
      disabled: false
    })
  }

  // Create organization (provider only)
  if (isProvider) {
    actions.push({
      to: `/tenant-admin/organizations/new?tenantId=${tenantId}`,
      icon: 'mdi:home-plus',
      label: t('admin.tenantAdmin.tenantActions.createOrg'),
      description: t('admin.tenantAdmin.tenantActions.createOrgDesc'),
      disabled: false
    })
  }

  // Members
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/members`,
    icon: 'mdi:account-group',
    label: t('admin.tenantAdmin.tenantActions.members'),
    description: t('admin.tenantAdmin.tenantActions.membersDesc'),
    disabled: false
  })

  // Email settings
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/email`,
    icon: 'mdi:email-outline',
    label: t('admin.tenantAdmin.tenantActions.email'),
    description: t('admin.tenantAdmin.tenantActions.emailDesc'),
    disabled: false
  })

  // Module permissions
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/modules`,
    icon: 'mdi:puzzle-outline',
    label: t('admin.tenantAdmin.tenantActions.modules'),
    description: t('admin.tenantAdmin.tenantActions.modulesDesc'),
    disabled: false
  })

  // MSP roles (provider only)
  if (isProvider) {
    actions.push({
      to: `/tenant-admin/tenants/${tenantId}/msp-roles`,
      icon: 'mdi:shield-account',
      label: t('admin.tenantAdmin.tenantActions.mspRoles'),
      description: t('admin.tenantAdmin.tenantActions.mspRolesDesc'),
      disabled: false
    })
  }

  // Role templates (distributor only)
  if (isDistributor) {
    actions.push({
      to: `/tenant-admin/distributors/${tenantId}/msp-role-templates`,
      icon: 'mdi:file-document-multiple-outline',
      label: t('admin.tenantAdmin.tenantActions.roleTemplates'),
      description: t('admin.tenantAdmin.tenantActions.roleTemplatesDesc'),
      disabled: false
    })
  }

  // Branding
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/branding`,
    icon: 'mdi:palette-outline',
    label: t('admin.tenantAdmin.tenantActions.branding'),
    description: t('admin.tenantAdmin.tenantActions.brandingDesc'),
    disabled: false
  })

  // Audit logs
  actions.push({
    to: `/tenant-admin/tenants/${tenantId}/audit-logs`,
    icon: 'mdi:file-document-outline',
    label: t('admin.tenantAdmin.tenantActions.auditLogs'),
    description: t('admin.tenantAdmin.tenantActions.auditLogsDesc'),
    disabled: false
  })

  return actions
})

const integrations = [
  { name: 'Cloudflare DNS', icon: 'mdi:shield-check', status: 'Unknown' },
  { name: 'Windows DNS', icon: 'mdi:dns', status: 'Unknown' },
  { name: 'RMM', icon: 'mdi:remote-desktop', status: 'Unknown' }
]

function getStatusClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'connected':
    case 'ok':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
    case 'error':
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
    case 'degraded':
    case 'warning':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
  }
}
</script>

