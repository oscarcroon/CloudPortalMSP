<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Cloudflare DNS</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Zoner & poster</h1>
      </div>
      <button class="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/10" @click="dnsStore.refreshZones">
        Uppdatera
      </button>
    </header>

    <div class="grid gap-6 lg:grid-cols-[280px,1fr]">
      <div class="space-y-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dina zoner</p>
        <ZoneList :zones="dnsStore.zones" :selected-zone-id="dnsStore.selectedZoneId" @select="dnsStore.selectZone" />
      </div>
      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">Aktiv zon</p>
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {{ activeZone?.name ?? 'Ingen zon vald' }}
              </h2>
            </div>
            <StatusPill v-if="activeZone" variant="success" dot>{{ activeZone.status }}</StatusPill>
          </div>
        </div>

        <RecordTable :records="dnsStore.records" />

        <RecordForm v-if="dnsStore.selectedZoneId" @submit="dnsStore.createRecord" />
        <p v-else class="text-sm text-slate-500 dark:text-slate-400">Välj en zon för att lägga till nya poster.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import RecordForm from '~/components/dns/RecordForm.vue'
import RecordTable from '~/components/dns/RecordTable.vue'
import ZoneList from '~/components/dns/ZoneList.vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useDnsStore } from '~/stores/dns'

const dnsStore = useDnsStore()
const activeZone = computed(() => dnsStore.zones.find((z) => z.id === dnsStore.selectedZoneId) ?? null)

onMounted(() => {
  dnsStore.bootstrap()
})
</script>

