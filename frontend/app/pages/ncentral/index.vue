<template>
  <section class="space-y-8">
    <header>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">nCentral</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">RMM-enheter</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Överblick över servrar, arbetsstationer och appliances som rapporterar in via nCentral.
      </p>
    </header>

    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
      <div class="flex flex-wrap items-center gap-6">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Online</p>
          <p class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {{ ncentralStore.statusSummary.online }}
          </p>
        </div>
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Varning</p>
          <p class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {{ ncentralStore.statusSummary.warning }}
          </p>
        </div>
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Offline</p>
          <p class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {{ ncentralStore.statusSummary.offline }}
          </p>
        </div>
        <StatusPill variant="info" class="ml-auto" dot v-if="ncentralStore.devices.length">
          Enheter: {{ ncentralStore.devices.length }}
        </StatusPill>
      </div>
      <div class="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Senast uppdaterad:
          {{ ncentralStore.lastUpdated ? formatTimestamp(ncentralStore.lastUpdated) : 'Hämtar...' }}
        </span>
        <button
          class="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand"
          :disabled="ncentralStore.isLoading"
          @click="ncentralStore.fetchDevices"
        >
          {{ ncentralStore.isLoading ? 'Uppdaterar...' : 'Uppdatera' }}
        </button>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <article
        v-for="device in ncentralStore.devices"
        :key="device.id"
        class="rounded-2xl border border-slate-100 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-900/70"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{{ device.type }}</p>
            <h3 class="text-xl font-semibold text-slate-900 dark:text-slate-100">{{ device.name }}</h3>
          </div>
          <StatusPill :variant="statusVariant(device.status)" dot>
            {{ device.status }}
          </StatusPill>
        </div>
        <dl class="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
          <div class="flex justify-between">
            <dt>OS-version</dt>
            <dd class="font-medium">{{ device.osVersion }}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Region</dt>
            <dd class="font-medium">{{ device.region }}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Senast sedd</dt>
            <dd class="font-medium">{{ formatTimestamp(device.lastSeen) }}</dd>
          </div>
        </dl>
      </article>
      <p v-if="!ncentralStore.devices.length" class="text-sm text-slate-500 dark:text-slate-400">
        Inga enheter rapporterar in ännu.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useNcentralStore } from '~/stores/ncentral'
import type { NcentralDevice } from '~/types/ncentral'

const ncentralStore = useNcentralStore()

onMounted(() => {
  ncentralStore.bootstrap()
})

function statusVariant(status: NcentralDevice['status']) {
  if (status === 'online') return 'success'
  if (status === 'warning') return 'warning'
  return 'danger'
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('sv-SE', {
    hour12: false
  })
}
</script>


