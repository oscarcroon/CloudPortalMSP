<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        :to="`/admin/tenants/${tenantId}`"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← {{ $t('admin.auditLogsPage.backToTenant') }}
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{{ $t('nav.superadmin') }}</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ $t('admin.auditLogsPage.title') }} - {{ tenant?.name ?? (tenantLoading ? $t('admin.auditLogsPage.loading') : 'N/A') }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ $t('admin.auditLogsPage.tenantSubtitle') }}
        </p>
      </div>
    </header>

    <!-- Access Denied -->
    <div v-if="accessDenied" class="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900/50 dark:bg-red-900/10">
      <div class="flex items-start gap-4">
        <Icon icon="mdi:lock-alert" class="h-6 w-6 text-red-600 dark:text-red-400" />
        <div>
          <h2 class="text-lg font-semibold text-red-900 dark:text-red-100">{{ $t('admin.auditLogsPage.accessDenied.title') }}</h2>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">
            {{ $t('admin.auditLogsPage.accessDenied.description') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div v-if="!accessDenied" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <form class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7" @submit.prevent="loadLogs()">
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.filters.context') }}</label>
          <select
            v-model="contextScope"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option v-for="option in contextOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.filters.module') }}</label>
          <select
            v-model="filters.moduleKey"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option value="">{{ $t('admin.auditLogsPage.filters.allModules') }}</option>
            <option v-for="mod in auditModules" :key="mod.moduleKey" :value="mod.moduleKey">
              {{ mod.moduleName }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.filters.eventType') }}</label>
          <select
            v-model="filters.eventType"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option value="">{{ $t('admin.auditLogsPage.filters.all') }}</option>
            <option v-for="et in filteredEventTypes" :key="et.type" :value="et.type">
              {{ et.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.filters.severity') }}</label>
          <select
            v-model="filters.severity"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option value="">{{ $t('admin.auditLogsPage.filters.all') }}</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.filters.fromDate') }}</label>
          <input
            v-model="filters.startDate"
            type="date"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.filters.toDate') }}</label>
          <input
            v-model="filters.endDate"
            type="date"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>

        <div class="flex items-end gap-2">
          <button
            type="submit"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
          >
            {{ $t('admin.auditLogsPage.filters.filter') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
            @click="clearFilters"
          >
            {{ $t('admin.auditLogsPage.filters.clear') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Loading state -->
    <div v-if="loading && !accessDenied" class="text-center text-slate-600 dark:text-slate-400">{{ $t('admin.auditLogsPage.loading') }}</div>

    <!-- Logs table -->
    <div v-else-if="!accessDenied" class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
      <table class="w-full">
        <thead class="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.table.timestamp') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.table.event') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.table.user') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.table.context') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.table.severity') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.table.ip') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ $t('admin.auditLogsPage.table.details') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-white/10">
          <tr v-for="log in logs" :key="log.id" class="hover:bg-slate-50 dark:hover:bg-white/5">
            <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-900 dark:text-white">
              {{ formatDate(log.createdAt) }}
            </td>
            <td class="px-4 py-3 text-sm text-slate-900 dark:text-white">
              <span class="font-mono text-xs">{{ log.eventType }}</span>
            </td>
            <td class="px-4 py-3 text-sm text-slate-900 dark:text-white">
              {{ log.userEmail || log.userName || $t('admin.auditLogsPage.table.na') }}
            </td>
            <td class="px-4 py-3 text-sm text-slate-900 dark:text-white">
              <span v-if="log.tenantId && log.tenantName">
                <span class="text-xs text-slate-500 dark:text-slate-400">{{ $t('admin.auditLogsPage.table.tenant') }}:</span>
                {{ log.tenantName }}
              </span>
              <span v-else-if="log.orgId && log.orgName">
                <span class="text-xs text-slate-500 dark:text-slate-400">{{ $t('admin.auditLogsPage.table.organization') }}:</span>
                {{ log.orgName }}
              </span>
              <span v-else class="text-slate-400 dark:text-slate-500">—</span>
            </td>
            <td class="px-4 py-3 text-sm">
              <span
                :class="{
                  'text-blue-600 dark:text-blue-400': log.severity === 'info',
                  'text-yellow-600 dark:text-yellow-400': log.severity === 'warning',
                  'text-red-600 dark:text-red-400': log.severity === 'error' || log.severity === 'critical'
                }"
                class="font-semibold uppercase"
              >
                {{ log.severity }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">
              {{ log.ip || $t('admin.auditLogsPage.table.na') }}
            </td>
            <td class="px-4 py-3 text-sm">
              <button
                v-if="log.meta"
                class="text-brand hover:underline"
                @click="showDetails(log)"
              >
                {{ $t('admin.auditLogsPage.table.view') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination && pagination.totalPages > 1" class="flex items-center justify-between">
      <div class="text-sm text-slate-600 dark:text-slate-400">
        {{ $t('admin.auditLogsPage.pagination.showing', { from: (pagination.page - 1) * pagination.pageSize + 1, to: Math.min(pagination.page * pagination.pageSize, pagination.total), total: pagination.total }) }}
      </div>
      <div class="flex gap-2">
        <button
          :disabled="pagination.page === 1"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-50 dark:border-white/10 dark:text-slate-200"
          @click="changePage(pagination.page - 1)"
        >
          {{ $t('admin.auditLogsPage.pagination.previous') }}
        </button>
        <button
          :disabled="pagination.page >= pagination.totalPages"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-50 dark:border-white/10 dark:text-slate-200"
          @click="changePage(pagination.page + 1)"
        >
          {{ $t('admin.auditLogsPage.pagination.next') }}
        </button>
      </div>
    </div>

    <!-- Details modal -->
    <div
      v-if="selectedLog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="selectedLog = null"
    >
      <div class="max-w-2xl rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900">
        <div class="border-b border-slate-200 p-4 dark:border-white/10">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ $t('admin.auditLogsPage.details.title') }}</h2>
            <button
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              @click="selectedLog = null"
            >
              <Icon icon="mdi:close" class="h-5 w-5" />
            </button>
          </div>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{{ $t('admin.auditLogsPage.details.eventType') }}</label>
            <p class="mt-1 font-mono text-sm text-slate-900 dark:text-white">{{ selectedLog.eventType }}</p>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{{ $t('admin.auditLogsPage.details.requestId') }}</label>
            <p class="mt-1 font-mono text-sm text-slate-900 dark:text-white">{{ selectedLog.requestId }}</p>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{{ $t('admin.auditLogsPage.details.metadata') }}</label>
            <pre class="mt-1 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-900 dark:bg-slate-800 dark:text-white">{{ JSON.stringify(selectedLog.meta, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from '#imports'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

definePageMeta({
  // Tenant admins can access audit logs for their tenant
  // Permission is checked in the API endpoint
})

const route = useRoute()
const router = useRouter()
const tenantId = route.params.id as string

interface AuditLog {
  id: string
  userId: string | null
  userEmail: string | null
  userName: string | null
  eventType: string
  severity: string
  requestId: string | null
  endpoint: string | null
  method: string | null
  orgId: string | null
  orgName: string | null
  tenantId: string | null
  tenantName: string | null
  ip: string | null
  userAgent: string | null
  meta: any
  createdAt: Date | string
}

interface TenantSummary {
  id: string
  name: string
  type: 'provider' | 'distributor' | 'organization'
}

type ContextScope = 'all' | 'tenant' | 'providers' | 'organizations'

const CONTEXT_SCOPE_VALUES: ContextScope[] = ['all', 'tenant', 'providers', 'organizations']

const parseContextScope = (value: unknown): ContextScope => {
  if (Array.isArray(value)) {
    return parseContextScope(value[0])
  }
  if (typeof value === 'string' && CONTEXT_SCOPE_VALUES.includes(value as ContextScope)) {
    return value as ContextScope
  }
  return 'all'
}

const tenant = ref<TenantSummary | null>(null)
const tenantLoading = ref(true)
const logs = ref<AuditLog[]>([])
const loading = ref(false)
const selectedLog = ref<AuditLog | null>(null)
const pagination = ref<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
const accessDenied = ref(false)
const hasProviders = ref(false)
const hasOrganizations = ref(false)
const contextScope = ref<ContextScope>(parseContextScope(route.query.contextScope))

// Audit modules and event types fetched from API
interface AuditEventOption {
  type: string
  label: string
}

interface AuditModule {
  moduleKey: string
  moduleName: string
  eventTypes: AuditEventOption[]
}

const auditModules = ref<AuditModule[]>([])

// Filtered event types based on selected module
const filteredEventTypes = computed(() => {
  if (!filters.value.moduleKey) {
    // Return all event types from all modules
    return auditModules.value.flatMap(m => m.eventTypes)
  }
  // Return only event types from selected module
  const selectedModule = auditModules.value.find(m => m.moduleKey === filters.value.moduleKey)
  return selectedModule?.eventTypes ?? []
})

const loadAuditModules = async () => {
  try {
    const response = await $fetch<{ modules: AuditModule[] }>('/api/admin/audit-logs/event-types?locale=sv')
    auditModules.value = response.modules || []
  } catch (error) {
    console.error('Failed to load audit modules', error)
    auditModules.value = []
  }
}

const contextOptions = computed(() => {
  const options: { value: ContextScope; label: string }[] = [
    { value: 'all', label: t('admin.auditLogsPage.filters.allContexts') },
    { value: 'tenant', label: t('admin.auditLogsPage.filters.tenantOnly') }
  ]

  if (tenant.value?.type === 'distributor') {
    if (hasProviders.value) {
      options.push({ value: 'providers', label: t('admin.auditLogsPage.filters.providersOnly') })
    }
    if (hasOrganizations.value) {
      options.push({ value: 'organizations', label: t('admin.auditLogsPage.filters.organizationsOnly') })
    }
  } else if (tenant.value?.type === 'provider' && hasOrganizations.value) {
    options.push({ value: 'organizations', label: t('admin.auditLogsPage.filters.organizationsOnly') })
  }

  return options
})

const normalizeScopeForTenant = (value: ContextScope): ContextScope => {
  const available = new Set(contextOptions.value.map(option => option.value))
  if (available.has(value)) {
    return value
  }
  if (available.has('tenant')) {
    return 'tenant'
  }
  return 'all'
}

watch(contextOptions, () => {
  const next = normalizeScopeForTenant(contextScope.value)
  if (next !== contextScope.value) {
    contextScope.value = next
  }
})

watch(
  () => route.query.contextScope,
  value => {
    const resolved = parseContextScope(value)
    const normalized = normalizeScopeForTenant(resolved)
    if (normalized !== contextScope.value) {
      contextScope.value = normalized
    }
  }
)

// Set default dates: 7 days back to today
const getDefaultDates = () => {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  
  return {
    startDate: weekAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0]
  }
}

const defaultDates = getDefaultDates()

const filters = ref({
  moduleKey: '',
  eventType: '',
  severity: '',
  startDate: defaultDates.startDate,
  endDate: defaultDates.endDate
})

// Clear eventType when module changes
watch(() => filters.value.moduleKey, () => {
  filters.value.eventType = ''
})

const loadTenant = async () => {
  tenantLoading.value = true
  try {
    const data = await $fetch<{
      tenant: TenantSummary
      linkedTenants?: { id: string; type: TenantSummary['type'] }[]
      organizations?: { id: string }[]
    }>(`/api/admin/tenants/${tenantId}`)
    tenant.value = data.tenant
    hasProviders.value = (data.linkedTenants ?? []).some(link => link.type === 'provider')
    hasOrganizations.value =
      data.tenant.type === 'distributor'
        ? hasProviders.value
        : (data.organizations?.length ?? 0) > 0
    contextScope.value = normalizeScopeForTenant(contextScope.value)
  } catch (error: any) {
    console.error('Failed to load tenant', error)
    if (error.statusCode === 403 || error.status === 403) {
      accessDenied.value = true
    }
  } finally {
    tenantLoading.value = false
  }
}

const syncRouteContextScope = () => {
  if (!import.meta.client) return
  const nextQuery: Record<string, any> = { ...route.query }
  if (contextScope.value && contextScope.value !== 'all') {
    nextQuery.contextScope = contextScope.value
  } else {
    delete nextQuery.contextScope
  }
  router.replace({ query: nextQuery })
}

const loadLogs = async (page = 1) => {
  loading.value = true
  accessDenied.value = false
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50'
    })
    
    params.append('contextScope', contextScope.value)
    if (filters.value.moduleKey) params.append('moduleKey', filters.value.moduleKey)
    if (filters.value.eventType) params.append('eventType', filters.value.eventType)
    if (filters.value.severity) params.append('severity', filters.value.severity)
    if (filters.value.startDate) params.append('startDate', filters.value.startDate)
    if (filters.value.endDate) params.append('endDate', filters.value.endDate)
    syncRouteContextScope()
    
    const response = await $fetch<{ logs: AuditLog[]; pagination: any }>(`/api/admin/tenants/${tenantId}/audit-logs?${params}`)
    logs.value = response.logs
    pagination.value = response.pagination
  } catch (error: any) {
    console.error('Failed to load audit logs', error)
    if (error.statusCode === 403 || error.status === 403) {
      accessDenied.value = true
    }
  } finally {
    loading.value = false
  }
}

const clearFilters = () => {
  const dates = getDefaultDates()
  filters.value = {
    moduleKey: '',
    eventType: '',
    severity: '',
    startDate: dates.startDate,
    endDate: dates.endDate
  }
  contextScope.value = normalizeScopeForTenant('all')
  loadLogs()
}

const changePage = (page: number) => {
  loadLogs(page)
}

const showDetails = (log: AuditLog) => {
  selectedLog.value = log
}

const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

onMounted(async () => {
  await Promise.all([
    loadTenant(),
    loadAuditModules()
  ])
  loadLogs()
})
</script>

