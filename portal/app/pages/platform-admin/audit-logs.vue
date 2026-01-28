<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Audit Loggar</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Visa alla säkerhetshändelser och administrativa aktiviteter i systemet.
      </p>
    </header>

    <!-- Filters -->
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <form class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7" @submit.prevent="loadLogs()">
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Modul</label>
          <select
            v-model="filters.moduleKey"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option value="">Alla moduler</option>
            <option v-for="mod in auditModules" :key="mod.moduleKey" :value="mod.moduleKey">
              {{ mod.moduleName }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Event Type</label>
          <select
            v-model="filters.eventType"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option value="">Alla</option>
            <option v-for="et in filteredEventTypes" :key="et.type" :value="et.type">
              {{ et.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Severity</label>
          <select
            v-model="filters.severity"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option value="">Alla</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Från datum</label>
          <input
            v-model="filters.startDate"
            type="date"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Till datum</label>
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
            Filtrera
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
            @click="clearFilters"
          >
            Rensa
          </button>
        </div>
      </form>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center text-slate-600 dark:text-slate-400">Laddar...</div>

    <!-- Logs table -->
    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
      <table class="w-full">
        <thead class="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Tidpunkt</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Event</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Användare</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Organisation</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Severity</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">IP</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Detaljer</th>
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
              {{ log.userEmail || log.userName || 'N/A' }}
            </td>
            <td class="px-4 py-3 text-sm text-slate-900 dark:text-white">
              {{ log.orgName || 'N/A' }}
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
              {{ log.ip || 'N/A' }}
            </td>
            <td class="px-4 py-3 text-sm">
              <button
                v-if="log.meta"
                class="text-brand hover:underline"
                @click="showDetails(log)"
              >
                Visa
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
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from '#imports'

definePageMeta({
  superAdmin: true
})

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

interface Filters {
  moduleKey: string
  eventType: string
  severity: string
  startDate: string
  endDate: string
}

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

const logs = ref<AuditLog[]>([])
const loading = ref(false)
const selectedLog = ref<AuditLog | null>(null)
const showDetailsModal = ref(false)
const pagination = ref<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)
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

const filters = ref<Filters>({
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

const loadLogs = async (page = 1) => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50'
    })
    
    if (filters.value.moduleKey) params.append('moduleKey', filters.value.moduleKey)
    if (filters.value.eventType) params.append('eventType', filters.value.eventType)
    if (filters.value.severity) params.append('severity', filters.value.severity)
    if (filters.value.startDate) params.append('startDate', filters.value.startDate)
    if (filters.value.endDate) params.append('endDate', filters.value.endDate)
    
    const response = await $fetch<{ logs: AuditLog[]; pagination: any }>(`/api/admin/audit-logs?${params}`)
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
    severity: '',
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
  // Load modules and logs in parallel
  await loadAuditModules()
  loadLogs()
})
</script>

