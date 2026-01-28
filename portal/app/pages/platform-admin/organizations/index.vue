<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ t('adminOrganizations.title') }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ t('adminOrganizations.description') }}
      </p>
    </header>

    <div
      v-if="deletedSlug"
      class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
    >
      {{ t('adminOrganizations.deleted', { slug: deletedSlug }) }}
    </div>

    <div class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <form class="flex flex-1 flex-col gap-2 sm:flex-row" @submit.prevent="applySearch">
        <input
          v-model="searchInput"
          type="text"
          class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          :placeholder="t('adminOrganizations.searchPlaceholder')"
          @input="applySearch"
        />
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
            @click="clearSearch"
          >
            {{ t('adminOrganizations.clear') }}
          </button>
        </div>
      </form>
      <div class="flex flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.status') }}</label>
          <select
            v-model="statusFilter"
            class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            @change="applyFilters"
          >
            <option value="">{{ t('adminOrganizations.all') }}</option>
            <option value="active">{{ t('adminOrganizations.active') }}</option>
            <option value="inactive">{{ t('adminOrganizations.inactive') }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.tenant') }}</label>
          <select
            v-model="tenantFilter"
            class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            @change="applyFilters"
          >
            <option value="">{{ t('adminOrganizations.all') }}</option>
            <option v-for="tenant in uniqueTenants" :key="tenant.id" :value="tenant.id">
              {{ tenant.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="flex gap-2">
        <NuxtLink
          to="/platform-admin/audit-logs"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          <Icon icon="mdi:file-document-outline" class="h-4 w-4" />
          {{ t('adminOrganizations.auditLogs') }}
        </NuxtLink>
        <NuxtLink
          to="/platform-admin/settings/email"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          <Icon icon="mdi:email-outline" class="h-4 w-4" />
          {{ t('adminOrganizations.globalEmail') }}
        </NuxtLink>
        <NuxtLink
          to="/platform-admin/users"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          <Icon icon="mdi:account-group-outline" class="h-4 w-4" />
          {{ t('adminOrganizations.manageUsers') }}
        </NuxtLink>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/5">
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('adminOrganizations.allOrganizations') }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('adminOrganizations.results', { count: organizations.length }) }}
            <span v-if="appliedQuery">{{ t('adminOrganizations.for', { query: appliedQuery }) }}</span>
            <span v-if="statusFilter || tenantFilter">
              <span v-if="appliedQuery"> • </span>
              <span v-if="statusFilter">{{ t('adminOrganizations.filters.statusLabel') }} {{ statusFilter === 'active' ? t('adminOrganizations.filters.statusActive') : t('adminOrganizations.filters.statusInactive') }}</span>
              <span v-if="statusFilter && tenantFilter"> • </span>
              <span v-if="tenantFilter">
                {{ t('adminOrganizations.filters.tenantLabel') }} {{ uniqueTenants.find(t => t.id === tenantFilter)?.name ?? tenantFilter }}
              </span>
            </span>
          </p>
        </div>
        <button
          class="rounded border border-slate-300 px-3 py-1 text-xs uppercase tracking-wide text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          @click="refreshList"
        >
          {{ t('adminOrganizations.refresh') }}
        </button>
      </div>

      <div v-if="listError" class="px-6 py-4 text-sm text-red-500">{{ listError }}</div>
      <div v-else-if="pending" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{{ t('adminOrganizations.loading') }}</div>
      <div v-else-if="!organizations.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
        {{ t('adminOrganizations.noResults') }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
          <thead class="bg-slate-50 dark:bg-white/5">
            <tr>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.table.organization') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.table.slug') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.table.status') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.table.tenant') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.table.members') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.table.email') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.table.sso') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminOrganizations.table.created') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-white/5">
            <tr
              v-for="org in organizations"
              :key="org.id"
              class="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
              @click="navigateToOrg(org.slug)"
            >
              <td class="px-6 py-3 text-slate-900 dark:text-white">
                <div class="font-semibold">{{ org.name }}</div>
              </td>
              <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ org.slug }}</td>
              <td class="px-6 py-3">
                <StatusPill :variant="org.status === 'active' ? 'success' : 'warning'">
                  {{ t(`adminOrganizations.status.${org.status}`) }}
                </StatusPill>
              </td>
              <td class="px-6 py-3 text-slate-700 dark:text-slate-200">
                <span v-if="org.tenantName" class="text-xs font-medium text-slate-900 dark:text-slate-100">
                  {{ org.tenantName }}
                </span>
                <span v-else class="text-xs text-slate-400 dark:text-slate-500">{{ t('adminOrganizations.noTenant') }}</span>
              </td>
              <td class="px-6 py-3 text-slate-700 dark:text-slate-200">
                <button
                  class="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/20 dark:text-slate-200"
                  @click.stop="navigateToMembers(org.slug)"
                >
                  {{ t('adminOrganizations.memberCount', { count: org.memberCount }) }}
                </button>
              </td>
              <td class="px-6 py-3">
                <span
                  v-if="org.hasEmailOverride"
                  class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  :title="t('adminOrganizations.emailOverride.active')"
                >
                  <Icon icon="mdi:email-check" class="h-3 w-3" />
                  {{ t('adminOrganizations.emailOverride.override') }}
                </span>
                <span v-else class="text-xs text-slate-400 dark:text-slate-500">{{ t('adminOrganizations.emailOverride.inherited') }}</span>
              </td>
              <td class="px-6 py-3">
                <StatusPill :variant="org.requireSso ? 'success' : 'info'">
                  {{ org.requireSso ? t('adminOrganizations.sso.on') : t('adminOrganizations.sso.off') }}
                </StatusPill>
              </td>
              <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                {{ formatDate(org.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from '#imports'

const { t } = useI18n()
import { computed, ref, useFetch, useRoute, useRouter } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { AdminOrganizationSummary } from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const router = useRouter()
const route = useRoute()
const searchInput = ref('')
const appliedQuery = ref('')
const statusFilter = ref('')
const tenantFilter = ref('')
const deletedSlug = ref(typeof route.query.deleted === 'string' ? route.query.deleted : '')

if (deletedSlug.value) {
  const updatedQuery = { ...route.query }
  delete updatedQuery.deleted
  router.replace({ query: updatedQuery })
}

const { data, pending, refresh, error } = await useFetch<{ organizations: AdminOrganizationSummary[] }>(
  '/api/admin/organizations',
  {
    query: () => {
      const query: Record<string, string> = {}
      if (appliedQuery.value) {
        query.q = appliedQuery.value
      }
      return query
    },
    watch: [appliedQuery]
  }
)

const allOrganizations = computed(() => data.value?.organizations ?? [])
const listError = computed(() => (error.value ? error.value.message : ''))

// Get unique tenants for filter dropdown
const uniqueTenants = computed(() => {
  const tenantMap = new Map<string, { id: string; name: string }>()
  for (const org of allOrganizations.value) {
    if (org.tenantId && org.tenantName && !tenantMap.has(org.tenantId)) {
      tenantMap.set(org.tenantId, { id: org.tenantId, name: org.tenantName })
    }
  }
  return Array.from(tenantMap.values()).sort((a, b) => a.name.localeCompare(b.name))
})

// Apply client-side filtering
const organizations = computed(() => {
  let filtered = allOrganizations.value

  // Filter by status
  if (statusFilter.value) {
    filtered = filtered.filter((org) => org.status === statusFilter.value)
  }

  // Filter by tenant
  if (tenantFilter.value) {
    filtered = filtered.filter((org) => org.tenantId === tenantFilter.value)
  }

  return filtered
})

const applySearch = () => {
  appliedQuery.value = searchInput.value.trim()
}

const applyFilters = () => {
  // Filters are applied via computed property, no need to refresh
}

const clearSearch = () => {
  searchInput.value = ''
  appliedQuery.value = ''
  statusFilter.value = ''
  tenantFilter.value = ''
  refresh()
}

const navigateToOrg = (slug: string) => {
  router.push(`/platform-admin/organizations/${slug}/overview`)
}

const navigateToMembers = (slug: string) => {
  router.push(`/platform-admin/organizations/${slug}/members`)
}

const refreshList = () => {
  refresh()
}

const formatDate = (value: number) =>
  new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
</script>

