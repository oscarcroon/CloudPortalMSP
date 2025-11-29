<template>
  <section class="space-y-8">
    <header>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Observability</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Övervakning</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Samlar inkommande alerts från Prometheus, RMM och backupplattformar.</p>
    </header>

    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
      <div class="grid gap-4 sm:grid-cols-3">
        <div v-for="summary in severitySummaries" :key="summary.key" class="space-y-1">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ summary.label }}</p>
          <p class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ summary.count }}</p>
        </div>
      </div>
      <div class="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Aktiva alerts: {{ monitoringStore.openAlerts.length }} · Totalt: {{ monitoringStore.alerts.length }}
      </div>
      <button
        class="mt-4 rounded-full border border-slate-200 px-4 py-1 text-sm font-medium transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand"
        :disabled="monitoringStore.isLoading"
        @click="monitoringStore.fetchAlerts"
      >
        {{ monitoringStore.isLoading ? 'Uppdaterar...' : 'Hämta senaste' }}
      </button>
    </div>

    <div class="space-y-6">
      <section
        v-for="group in severityGroups"
        :key="group.key"
        class="rounded-2xl border border-slate-100 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-900/70"
      >
        <div class="flex items-center gap-3">
          <StatusPill :variant="group.variant" dot>{{ group.label }}</StatusPill>
          <span class="text-sm text-slate-500 dark:text-slate-400">
            {{ group.alerts.length ? group.alerts.length + ' larm' : 'Inga aktiva' }}
          </span>
        </div>

        <div class="mt-4 space-y-4" v-if="group.alerts.length">
          <article
            v-for="alert in group.alerts"
            :key="alert.id"
            class="rounded-xl border border-slate-100 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/60"
          >
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ alert.title }}</h3>
              <StatusPill :variant="statusVariant(alert.status)" dot>{{ alert.status }}</StatusPill>
              <span class="text-xs text-slate-500 dark:text-slate-400">{{ alert.source }}</span>
            </div>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ alert.description }}</p>
            <dl class="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div class="flex items-center gap-1">
                <span class="font-semibold">Skapad:</span>
                <span>{{ formatTimestamp(alert.createdAt) }}</span>
              </div>
              <div v-if="alert.resolvedAt" class="flex items-center gap-1">
                <span class="font-semibold">Löst:</span>
                <span>{{ formatTimestamp(alert.resolvedAt) }}</span>
              </div>
            </dl>
            <div class="mt-4 flex gap-2 text-sm" v-if="alert.status === 'open'">
              <button
                class="rounded-full border border-slate-200 px-3 py-1 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand"
                @click="monitoringStore.acknowledgeAlert(alert.id)"
              >
                Kvitera
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useMonitoringStore } from '~/stores/monitoring'
import type { MonitoringAlert } from '~/types/monitoring'

const monitoringStore = useMonitoringStore()

const severityMeta = [
  { key: 'critical', label: 'Kritiska', variant: 'danger' },
  { key: 'warning', label: 'Varningar', variant: 'warning' },
  { key: 'info', label: 'Information', variant: 'info' }
] as const

onMounted(() => {
  monitoringStore.bootstrap()
})

const severityGroups = computed(() =>
  severityMeta.map((meta) => ({
    ...meta,
    alerts: monitoringStore.sortedAlerts.filter((alert) => alert.severity === meta.key)
  }))
)

const severitySummaries = computed(() =>
  severityMeta.map((meta) => ({
    ...meta,
    count: monitoringStore.openAlerts.filter((alert) => alert.severity === meta.key).length
  }))
)

function statusVariant(status: MonitoringAlert['status']) {
  if (status === 'resolved') return 'success'
  if (status === 'acknowledged') return 'info'
  return 'danger'
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('sv-SE', { hour12: false })
}
</script>


