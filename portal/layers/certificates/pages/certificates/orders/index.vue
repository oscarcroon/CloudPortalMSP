<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="flex flex-col gap-2">
        <NuxtLink to="/certificates" class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400">
          <Icon icon="mdi:arrow-left" class="h-4 w-4" />
          {{ $t('certificates.title') }}
        </NuxtLink>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          {{ $t('certificates.orders.title') }}
        </h1>
        <div class="mt-1 flex items-center gap-2">
          <div class="relative w-full max-w-xs">
            <Icon icon="mdi:magnify" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              v-model="search"
              type="search"
              placeholder="Search domains..."
              class="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
            />
          </div>
          <select v-model="statusFilter" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <NuxtLink
        to="/certificates/orders/new"
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px]"
      >
        <Icon icon="mdi:plus" class="h-4 w-4" />
        {{ $t('certificates.orders.new') }}
      </NuxtLink>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">{{ $t('certificates.common.loading') }}</div>

    <div v-else-if="orders.length === 0" class="mod-certificates-panel text-center py-12">
      <Icon icon="mdi:certificate-outline" class="mx-auto h-12 w-12 text-slate-300" />
      <p class="mt-4 text-sm text-slate-500">{{ $t('certificates.common.noData') }}</p>
    </div>

    <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table class="w-full text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.certificates.domain') }}</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.validationMethod') }}</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.installationTarget') }}</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.agents.status') }}</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">Created</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-50">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
          <tr v-for="order in orders" :key="order.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <td class="px-4 py-3">
              <NuxtLink :to="`/certificates/orders/${order.id}`" class="font-medium text-brand hover:underline">
                {{ order.primaryDomain }}
              </NuxtLink>
              <p v-if="order.subjectAlternativeNames?.length" class="text-xs text-slate-400">
                +{{ order.subjectAlternativeNames.length }} SANs
              </p>
            </td>
            <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{{ order.validationMethod }}</td>
            <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{{ order.installationTarget }}</td>
            <td class="px-4 py-3"><CertStatusBadge :status="order.status" /></td>
            <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{{ formatDate(order.createdAt) }}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <button
                  v-if="order.status === 'failed'"
                  class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
                  @click="retryOrder(order.id)"
                >
                  <Icon icon="mdi:refresh" class="h-3.5 w-3.5" />
                  {{ $t('certificates.orders.retry') }}
                </button>
                <button
                  v-if="!['completed', 'cancelled'].includes(order.status)"
                  class="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                  @click="cancelOrder(order.id)"
                >
                  <Icon icon="mdi:close-circle-outline" class="h-3.5 w-3.5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination && pagination.totalPages > 1" class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
      <span>Page {{ pagination.page }} of {{ pagination.totalPages }} ({{ pagination.total }} total)</span>
      <div class="flex gap-2">
        <button
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
          :disabled="pagination.page <= 1"
          @click="page--; fetchOrders()"
        >
          Previous
        </button>
        <button
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
          :disabled="pagination.page >= pagination.totalPages"
          @click="page++; fetchOrders()"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CertStatusBadge from '../../../components/CertStatusBadge.vue'

const orders = ref<any[]>([])
const pagination = ref<any>(null)
const loading = ref(true)
const page = ref(1)
const search = ref('')
const statusFilter = ref('')

let searchDebounce: ReturnType<typeof setTimeout> | null = null

const fetchOrders = async () => {
  loading.value = true
  try {
    const query: any = { page: page.value }
    if (search.value) query.search = search.value
    if (statusFilter.value) query.status = statusFilter.value
    const res = await $fetch<any>('/api/certificates/orders', { query })
    orders.value = res.orders ?? []
    pagination.value = res.pagination
  } catch { /* handled by empty state */ }
  finally { loading.value = false }
}

watch([search, statusFilter], () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 1
    fetchOrders()
  }, 300)
})

const retryOrder = async (id: string) => {
  try {
    await $fetch(`/api/certificates/orders/${id}/retry`, { method: 'POST' })
    await fetchOrders()
  } catch (err: any) {
    alert(err?.data?.message ?? 'Failed to retry')
  }
}

const cancelOrder = async (id: string) => {
  if (!confirm('Cancel this order?')) return
  try {
    await $fetch(`/api/certificates/orders/${id}`, { method: 'DELETE' })
    await fetchOrders()
  } catch (err: any) {
    alert(err?.data?.message ?? 'Failed to cancel')
  }
}

const formatDate = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sv-SE')
}

onMounted(() => fetchOrders())
</script>
