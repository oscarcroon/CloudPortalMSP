<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{{ t('settings.administration') }}</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ t('settings.audit.title') }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ t('settings.audit.pageDescription') }}
      </p>
    </header>

    <div v-if="!hasActiveOrg" class="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
      {{ t('settings.audit.noActiveOrg') }}
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <form class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ t('settings.audit.module') }}</label>
            <select
              v-model="filters.moduleKey"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              <option value="">{{ t('settings.audit.all') }}</option>
              <option v-for="mod in auditModules" :key="mod.moduleKey" :value="mod.moduleKey">
                {{ mod.moduleName }}
              </option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ t('settings.audit.eventType') }}</label>
            <select
              v-model="filters.eventType"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              <option value="">{{ t('settings.audit.all') }}</option>
              <option v-for="et in filteredEventTypes" :key="et.type" :value="et.type">
                {{ et.label }}
              </option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ t('settings.audit.fromDate') }}</label>
            <input
              v-model="filters.startDate"
              type="date"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{{ t('settings.audit.toDate') }}</label>
            <input
              v-model="filters.endDate"
              type="date"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>

          <div class="flex items-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
              @click="clearFilters"
            >
              {{ t('settings.audit.clear') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="text-center text-slate-600 dark:text-slate-400">{{ t('settings.audit.loading') }}</div>

      <!-- Logs table -->
      <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <table class="w-full">
          <thead class="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ t('settings.audit.table.timestamp') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ t('settings.audit.table.event') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ t('settings.audit.table.user') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{{ t('settings.audit.table.details') }}</th>
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
                {{ log.userEmail || log.userName || t('settings.audit.table.na') }}
              </td>
              <td class="px-4 py-3 text-sm">
                <button
                  v-if="log.meta"
                  class="text-brand hover:underline"
                  @click="showDetails(log)"
                >
                  {{ t('settings.audit.table.view') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination && pagination.totalPages > 1" class="flex items-center justify-between">
        <div class="text-sm text-slate-600 dark:text-slate-400">
          Visar {{ (pagination.page - 1) * pagination.pageSize + 1 }} - {{ Math.min(pagination.page * pagination.pageSize, pagination.total) }} av {{ pagination.total }}
        </div>
        <div class="flex gap-2">
          <button
            :disabled="pagination.page === 1"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-50 dark:border-white/10 dark:text-slate-200"
            @click="changePage(pagination.page - 1)"
          >
            Föregående
          </button>
          <button
            :disabled="pagination.page >= pagination.totalPages"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-50 dark:border-white/10 dark:text-slate-200"
            @click="changePage(pagination.page + 1)"
          >
            Nästa
          </button>
        </div>
      </div>

      <!-- Details modal -->
      <AuditLogDetailsModal
        v-if="selectedLog"
        v-model="showDetailsModal"
        :log="selectedLog"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from '#imports'

const { t } = useI18n()
import { ref, computed, onMounted, watch } from '#imports'
import { useAuth } from '~/composables/useAuth'
import { usePermission } from '~/composables/usePermission'

const auth = useAuth()
const permission = usePermission()

const hasActiveOrg = computed(() => Boolean(auth.state.value.data?.currentOrgId))
const canViewAudit = computed(() => permission.hasPermission('audit:read'))

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
  ip: string | null
  userAgent: string | null
  meta: any
  createdAt: Date | string
}

const logs = ref<AuditLog[]>([])
const loading = ref(false)
const selectedLog = ref<AuditLog | null>(null)
const showDetailsModal = ref(false)
const pagination = ref<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)

// Event type groups fetched from API (dynamically loaded from audit registry)
interface EventTypeOption {
  type: string
  label: string
}

interface EventTypeGroup {
  moduleKey: string
  moduleName: string
  eventTypes: EventTypeOption[]
}

const auditModules = ref<EventTypeGroup[]>([])

const filteredEventTypes = computed(() => {
  if (!filters.value.moduleKey) {
    return auditModules.value.flatMap(group => group.eventTypes)
  }
  const selectedModule = auditModules.value.find(group => group.moduleKey === filters.value.moduleKey)
  return selectedModule?.eventTypes ?? []
})

const loadEventTypes = async () => {
  if (!hasActiveOrg.value) return

  try {
    const orgId = auth.state.value.data?.currentOrgId
    const { locale } = useI18n()
    const response = await ($fetch as any)(
      `/api/organizations/${orgId}/audit-logs/event-types?locale=${locale.value}`
    )
    auditModules.value = response.groups || []
  } catch (error) {
    console.error('Failed to load event types', error)
    // Fallback to empty groups - user can still see logs without filter
    auditModules.value = []
  }
}

// Set default dates: 1 day back to today
const getDefaultDates = () => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  return {
    startDate: yesterday.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0]
  }
}

const defaultDates = getDefaultDates()

const filters = ref({
  moduleKey: '',
  eventType: '',
  startDate: defaultDates.startDate,
  endDate: defaultDates.endDate
})

const isReady = ref(false)
const suppressNextFilterLoad = ref(false)

const triggerFilterReload = () => {
  if (!isReady.value) return
  loadLogs(1)
}

watch(() => filters.value.moduleKey, () => {
  if (filters.value.eventType) {
    suppressNextFilterLoad.value = true
    filters.value.eventType = ''
  }
  triggerFilterReload()
})

watch(() => filters.value.eventType, () => {
  if (suppressNextFilterLoad.value) {
    suppressNextFilterLoad.value = false
    return
  }
  triggerFilterReload()
})

watch(() => filters.value.startDate, triggerFilterReload)
watch(() => filters.value.endDate, triggerFilterReload)

const loadLogs = async (page = 1) => {
  if (!hasActiveOrg.value || !canViewAudit.value) return
  
  loading.value = true
  try {
    const orgId = auth.state.value.data?.currentOrgId
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50'
    })
    
    if (filters.value.moduleKey) params.append('moduleKey', filters.value.moduleKey)
    if (filters.value.eventType) params.append('eventType', filters.value.eventType)
    if (filters.value.startDate) params.append('startDate', filters.value.startDate)
    if (filters.value.endDate) params.append('endDate', filters.value.endDate)
    
    const response = await ($fetch as any)(`/api/organizations/${orgId}/audit-logs?${params}`)
    logs.value = response.logs
    pagination.value = response.pagination
  } catch (error) {
    console.error('Failed to load audit logs', error)
  } finally {
    loading.value = false
  }
}

const clearFilters = () => {
  const dates = getDefaultDates()
  filters.value = {
    moduleKey: '',
    eventType: '',
    startDate: dates.startDate,
    endDate: dates.endDate
  }
  loadLogs()
}

const changePage = (page: number) => {
  loadLogs(page)
}

const showDetails = (log: AuditLog) => {
  selectedLog.value = log
  showDetailsModal.value = true
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
  if (!auth.state.value.initialized) {
    await auth.bootstrap()
  }
  if (hasActiveOrg.value && canViewAudit.value) {
    // Load event types and logs in parallel
    await Promise.all([
      loadEventTypes(),
      loadLogs()
    ])
    isReady.value = true
  }
})
</script>

