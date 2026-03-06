<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="flex flex-col gap-2">
        <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ $t('certificates.title') }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          {{ $t('certificates.dashboard.title') }}
        </h1>
      </div>
      <div class="flex items-center gap-2 self-start">
        <button
          class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
          :disabled="loading"
          @click="fetchDashboard"
        >
          <Icon icon="mdi:refresh" class="h-5 w-5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </header>

    <!-- Summary cards -->
    <div v-if="data" class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <CertSummaryCard
        :label="$t('certificates.dashboard.activeCertificates')"
        :value="data.summary.activeCertificates"
        icon="mdi:shield-check-outline"
        color="emerald"
      />
      <CertSummaryCard
        :label="$t('certificates.dashboard.expiringCertificates')"
        :value="data.summary.expiringCertificates"
        icon="mdi:clock-alert-outline"
        color="amber"
      />
      <CertSummaryCard
        :label="$t('certificates.dashboard.pendingOrders')"
        :value="data.summary.pendingOrders"
        icon="mdi:clock-outline"
        color="blue"
      />
      <CertSummaryCard
        :label="$t('certificates.dashboard.agentsOnline')"
        :value="`${data.summary.agentsOnline}/${data.summary.agentsTotal}`"
        icon="mdi:robot-outline"
        color="purple"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading && !data" class="text-sm text-slate-500 dark:text-slate-400">
      {{ $t('certificates.common.loading') }}
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
    >
      <div class="flex items-start gap-3">
        <Icon icon="mdi:alert-circle-outline" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          <p class="font-semibold">{{ error }}</p>
          <button
            class="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
            @click="fetchDashboard"
          >
            <Icon icon="mdi:refresh" class="h-3.5 w-3.5" />
            {{ $t('certificates.common.cancel') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Recent orders -->
    <section v-if="data && data.recentOrders.length > 0" class="mod-certificates-panel space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {{ $t('certificates.dashboard.recentOrders') }}
        </h3>
        <NuxtLink
          to="/certificates/orders"
          class="text-sm font-medium text-brand hover:underline"
        >
          {{ $t('certificates.orders.title') }} →
        </NuxtLink>
      </div>
      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.certificates.domain') }}</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.validation.http01').split('-')[0] }}</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.agents.status') }}</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.certificates.issuedAt') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
            <tr v-for="order in data.recentOrders" :key="order.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td class="px-4 py-3">
                <NuxtLink :to="`/certificates/orders/${order.id}`" class="font-medium text-brand hover:underline">
                  {{ order.primaryDomain }}
                </NuxtLink>
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{{ order.validationMethod }}</td>
              <td class="px-4 py-3">
                <CertStatusBadge :status="order.status" />
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{{ formatDate(order.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Expiring certificates -->
    <section v-if="data && data.expiringCerts.length > 0" class="mod-certificates-panel space-y-4">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
        {{ $t('certificates.dashboard.expiringList') }}
      </h3>
      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.certificates.domain') }}</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.certificates.issuer') }}</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.certificates.expiresAt') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
            <tr v-for="cert in data.expiringCerts" :key="cert.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">{{ cert.primaryDomain }}</td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{{ cert.issuer ?? '—' }}</td>
              <td class="px-4 py-3">
                <span class="mod-certificates-status-expiring font-medium">{{ formatDate(cert.expiresAt) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Quick links -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <NuxtLink
        to="/certificates/orders/new"
        class="mod-certificates-panel flex items-center gap-4 transition hover:border-brand"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon icon="mdi:plus-circle-outline" class="h-5 w-5" />
        </div>
        <div>
          <p class="font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.new') }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ $t('certificates.orders.wizard.title') }}</p>
        </div>
      </NuxtLink>
      <NuxtLink
        to="/certificates/agents"
        class="mod-certificates-panel flex items-center gap-4 transition hover:border-brand"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
          <Icon icon="mdi:robot-outline" class="h-5 w-5" />
        </div>
        <div>
          <p class="font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.agents.title') }}</p>
        </div>
      </NuxtLink>
      <NuxtLink
        to="/certificates/credential-sets"
        class="mod-certificates-panel flex items-center gap-4 transition hover:border-brand"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <Icon icon="mdi:key-outline" class="h-5 w-5" />
        </div>
        <div>
          <p class="font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.credentialSets.title') }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CertSummaryCard from '../../components/CertSummaryCard.vue'
import CertStatusBadge from '../../components/CertStatusBadge.vue'

const data = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const fetchDashboard = async () => {
  loading.value = true
  error.value = null
  try {
    data.value = await $fetch('/api/certificates/dashboard')
  } catch (err: any) {
    error.value = err?.data?.message ?? err?.message ?? 'Failed to load dashboard'
  } finally {
    loading.value = false
  }
}

const formatDate = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sv-SE')
}

onMounted(() => fetchDashboard())
</script>
