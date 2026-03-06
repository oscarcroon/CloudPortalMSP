<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2">
      <NuxtLink to="/certificates/orders" class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400">
        <Icon icon="mdi:arrow-left" class="h-4 w-4" />
        {{ $t('certificates.orders.title') }}
      </NuxtLink>
      <div class="flex items-center gap-3">
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          {{ order?.primaryDomain ?? '...' }}
        </h1>
        <CertStatusBadge v-if="order" :status="order.status" />
      </div>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">{{ $t('certificates.common.loading') }}</div>

    <template v-else-if="order">
      <!-- Order details -->
      <section class="mod-certificates-panel space-y-3">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.detail') }}</h3>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt class="text-slate-500 dark:text-slate-400">Primary Domain</dt>
          <dd class="font-medium text-slate-900 dark:text-slate-50">{{ order.primaryDomain }}</dd>

          <template v-if="order.subjectAlternativeNames?.length">
            <dt class="text-slate-500 dark:text-slate-400">SANs</dt>
            <dd class="font-medium text-slate-900 dark:text-slate-50">{{ order.subjectAlternativeNames.join(', ') }}</dd>
          </template>

          <dt class="text-slate-500 dark:text-slate-400">Validation</dt>
          <dd class="font-medium text-slate-900 dark:text-slate-50">{{ order.validationMethod }}</dd>

          <dt class="text-slate-500 dark:text-slate-400">Installation</dt>
          <dd class="font-medium text-slate-900 dark:text-slate-50">{{ order.installationTarget }}</dd>

          <dt class="text-slate-500 dark:text-slate-400">Auto-Renew</dt>
          <dd class="font-medium text-slate-900 dark:text-slate-50">{{ order.autoRenew ? `Yes (${order.renewDaysBefore}d)` : 'No' }}</dd>

          <dt class="text-slate-500 dark:text-slate-400">Renewal Name</dt>
          <dd class="font-mono text-xs text-slate-600 dark:text-slate-400">{{ order.renewalName ?? '—' }}</dd>

          <dt class="text-slate-500 dark:text-slate-400">Created</dt>
          <dd class="text-slate-600 dark:text-slate-400">{{ formatDate(order.createdAt) }}</dd>
        </dl>

        <div v-if="order.status === 'failed'" class="flex gap-2 pt-2">
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
            :disabled="retrying"
            @click="retryOrder"
          >
            <Icon v-if="retrying" icon="mdi:loading" class="h-4 w-4 animate-spin" />
            <Icon v-else icon="mdi:refresh" class="h-4 w-4" />
            {{ $t('certificates.orders.retry') }}
          </button>
        </div>
      </section>

      <!-- Run history -->
      <section class="mod-certificates-panel space-y-4">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.runs') }}</h3>

        <div v-if="runs.length === 0" class="text-sm text-slate-500 dark:text-slate-400">{{ $t('certificates.orders.noRuns') }}</div>

        <div v-for="run in runs" :key="run.id" class="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-slate-900 dark:text-slate-50">Run #{{ run.runNumber }}</span>
              <CertStatusBadge :status="run.status" />
            </div>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ formatDate(run.createdAt) }}</span>
          </div>

          <div v-if="run.errorMessage" class="mt-2 text-sm text-red-600 dark:text-red-400">
            <strong>Error:</strong> {{ run.errorMessage }}
            <span v-if="run.errorCode" class="ml-1 text-xs">( {{ run.errorCode }} )</span>
          </div>

          <div v-if="run.resultMeta" class="mt-2">
            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <template v-if="run.resultMeta.thumbprint">
                <dt class="text-slate-500">Thumbprint</dt>
                <dd class="font-mono text-slate-700 dark:text-slate-300">{{ run.resultMeta.thumbprint }}</dd>
              </template>
              <template v-if="run.resultMeta.serial">
                <dt class="text-slate-500">Serial</dt>
                <dd class="font-mono text-slate-700 dark:text-slate-300">{{ run.resultMeta.serial }}</dd>
              </template>
              <template v-if="run.resultMeta.expiresAt">
                <dt class="text-slate-500">Expires</dt>
                <dd class="text-slate-700 dark:text-slate-300">{{ formatDate(run.resultMeta.expiresAt) }}</dd>
              </template>
            </dl>
          </div>

          <!-- Expandable logs -->
          <details v-if="run.logs" class="mt-3">
            <summary class="cursor-pointer text-xs font-medium text-brand hover:underline">{{ $t('certificates.orders.logs') }}</summary>
            <pre class="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">{{ run.logs }}</pre>
          </details>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CertStatusBadge from '../../../components/CertStatusBadge.vue'

const route = useRoute()
const id = computed(() => route.params.id as string)

const order = ref<any>(null)
const runs = ref<any[]>([])
const loading = ref(true)
const retrying = ref(false)

const fetchOrder = async () => {
  loading.value = true
  try {
    const res = await $fetch<any>(`/api/certificates/orders/${id.value}`)
    order.value = res.order
    runs.value = res.runs ?? []
  } catch { /* handled by empty state */ }
  finally { loading.value = false }
}

const retryOrder = async () => {
  retrying.value = true
  try {
    await $fetch(`/api/certificates/orders/${id.value}/retry`, { method: 'POST' })
    await fetchOrder()
  } catch (err: any) {
    alert(err?.data?.message ?? 'Failed to retry')
  } finally {
    retrying.value = false
  }
}

const formatDate = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('sv-SE')
}

onMounted(() => fetchOrder())
</script>
