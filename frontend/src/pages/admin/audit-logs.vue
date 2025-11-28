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
      <form class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5" @submit.prevent="loadLogs">
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Event Type</label>
          <select
            v-model="filters.eventType"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option value="">Alla</option>
            <option v-for="type in eventTypes" :key="type" :value="type">{{ type }}</option>
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
    <div
      v-if="selectedLog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="selectedLog = null"
    >
      <div class="max-w-2xl rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900">
        <div class="border-b border-slate-200 p-4 dark:border-white/10">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Logg Detaljer</h2>
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
            <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Event Type</label>
            <p class="mt-1 font-mono text-sm text-slate-900 dark:text-white">{{ selectedLog.eventType }}</p>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Request ID</label>
            <p class="mt-1 font-mono text-sm text-slate-900 dark:text-white">{{ selectedLog.requestId }}</p>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Metadata</label>
            <pre class="mt-1 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-900 dark:bg-slate-800 dark:text-white">{{ JSON.stringify(selectedLog.meta, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from '#imports'
import type { AuditEventType } from '~/server/utils/audit'

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
  eventType: string
  severity: string
  startDate: string
  endDate: string
}

const logs = ref<AuditLog[]>([])
const loading = ref(false)
const selectedLog = ref<AuditLog | null>(null)
const pagination = ref<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)

const eventTypes: AuditEventType[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'USER_INVITED',
  'USER_REMOVED',
  'ROLE_CHANGED',
  'ORGANIZATION_CREATED',
  'ORGANIZATION_UPDATED',
  'ORGANIZATION_DELETED',
  'TENANT_CREATED',
  'TENANT_UPDATED',
  'TENANT_DELETED',
  'PERMISSION_DENIED',
  'RATE_LIMIT_EXCEEDED',
  'MODULE_ENABLED',
  'MODULE_DISABLED'
]

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
  eventType: '',
  severity: '',
  startDate: defaultDates.startDate,
  endDate: defaultDates.endDate
})

const loadLogs = async (page = 1) => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50'
    })
    
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

onMounted(() => {
  // Load logs with default date filter
  loadLogs()
})
</script>

