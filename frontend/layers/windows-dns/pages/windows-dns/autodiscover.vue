<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2">
      <NuxtLink
        to="/windows-dns"
        class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand dark:text-slate-400"
      >
        <Icon icon="mdi:arrow-left" class="h-4 w-4" />
        Back to zones
      </NuxtLink>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
        Autodiscover Zones
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Find zones matching your COREID and claim ownership.
      </p>
    </header>

    <div
      class="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 dark:border-brand/30 dark:bg-brand/10"
    >
      <div class="flex items-center gap-3">
        <Icon icon="mdi:information-outline" class="h-5 w-5 text-brand" />
        <p class="text-sm text-slate-700 dark:text-slate-200">
          Autodiscover searches for zones with a TXT record containing
          <code class="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">COREID=&lt;your-id&gt;</code>
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="state.pending"
        @click="runAutodiscover"
      >
        <Icon icon="mdi:auto-fix" class="h-4 w-4" :class="{ 'animate-spin': state.pending }" />
        {{ state.pending ? 'Searching...' : 'Run Autodiscover' }}
      </button>
    </div>

    <div v-if="state.error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
      <div class="flex items-start gap-2">
        <Icon icon="mdi:alert-circle" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>{{ state.error }}</p>
      </div>
    </div>

    <div v-if="state.data && state.data.zones.length > 0" class="space-y-3">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
        Found {{ state.data.zones.length }} matching {{ state.data.zones.length === 1 ? 'zone' : 'zones' }}
      </h2>

      <div class="space-y-2">
        <div
          v-for="zone in state.data.zones"
          :key="zone.zoneId"
          class="mod-windows-dns-zone-card flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <Icon icon="mdi:dns" class="h-5 w-5 text-slate-400" />
            <div>
              <p class="font-medium text-slate-900 dark:text-slate-50">{{ zone.zoneName }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ zone.serverName }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="zone.owned" class="mod-windows-dns-badge-owned">
              <Icon icon="mdi:check-circle" class="h-3 w-3" />
              Owned
            </span>
            <span v-else-if="zone.claimable" class="mod-windows-dns-badge-claimable">
              <Icon icon="mdi:hand-pointing-right" class="h-3 w-3" />
              Claimable
            </span>
            <button
              v-if="zone.claimable"
              class="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90"
              @click="claimZone(zone)"
            >
              Claim
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="state.data && state.data.zones.length === 0"
      class="text-center py-12"
    >
      <Icon icon="mdi:magnify-close" class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
      <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">
        No zones found matching your COREID
      </p>
      <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">
        Make sure zones have a TXT record with your COREID value
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

type AutodiscoverZone = {
  zoneId: string
  zoneName: string
  serverId: string
  serverName: string
  zoneType: string
  owned: boolean
  claimable: boolean
}

type AutodiscoverResponse = {
  zones: AutodiscoverZone[]
}

const state = reactive<{
  data: AutodiscoverResponse | null
  error: string | null
  pending: boolean
}>({
  data: null,
  error: null,
  pending: false
})

const runAutodiscover = async () => {
  state.pending = true
  state.error = null
  try {
    const res = await $fetch<AutodiscoverResponse>('/api/dns/windows/autodiscover/zones')
    state.data = res
  } catch (err: any) {
    state.error = err?.data?.message ?? err?.message ?? 'Autodiscover failed.'
  } finally {
    state.pending = false
  }
}

const claimZone = async (zone: AutodiscoverZone) => {
  try {
    await $fetch(`/api/dns/windows/zones/${zone.zoneId}/claim`, {
      method: 'POST'
    })
    // Refresh autodiscover results
    await runAutodiscover()
  } catch (err: any) {
    state.error = err?.data?.message ?? err?.message ?? 'Failed to claim zone.'
  }
}
</script>

