<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2">
      <NuxtLink
        to="/windows-dns"
        class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand dark:text-slate-400"
      >
        <Icon icon="mdi:arrow-left" class="h-4 w-4" />
        Tillbaka till zoner
      </NuxtLink>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
        Autodiscover Zoner
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Hitta zoner som matchar din organisations COREID och aktivera dem.
      </p>
    </header>

    <div
      class="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 dark:border-brand/30 dark:bg-brand/10"
    >
      <div class="flex items-center gap-3">
        <Icon icon="mdi:information-outline" class="h-5 w-5 text-brand" />
        <div class="text-sm text-slate-700 dark:text-slate-200">
          <p>
            Autodiscover söker efter zoner med en TXT-post som innehåller
            <code class="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">COREID={{ state.coreId || '<din-id>' }}</code>
          </p>
          <p v-if="state.coreId" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Din organisations COREID: <strong>{{ state.coreId }}</strong>
          </p>
        </div>
      </div>
    </div>

    <!-- Success message -->
    <div
      v-if="state.successMessage"
      class="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200"
    >
      <div class="flex items-start gap-2">
        <Icon icon="mdi:check-circle" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>{{ state.successMessage }}</p>
      </div>
    </div>

    <!-- Error message -->
    <div
      v-if="state.error"
      class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
    >
      <div class="flex items-start gap-2">
        <Icon icon="mdi:alert-circle" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>{{ state.error }}</p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="state.pending || state.activating"
        @click="runAutodiscover"
      >
        <Icon icon="mdi:auto-fix" class="h-4 w-4" :class="{ 'animate-spin': state.pending }" />
        {{ state.pending ? 'Söker...' : 'Kör Autodiscover' }}
      </button>

      <!-- Activate All button -->
      <button
        v-if="unactivatedZones.length > 0"
        class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-600/60 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="state.activating || state.pending"
        @click="activateAll"
      >
        <Icon icon="mdi:check-all" class="h-4 w-4" :class="{ 'animate-pulse': state.activating }" />
        {{ state.activating ? 'Aktiverar...' : `Aktivera alla (${unactivatedZones.length})` }}
      </button>
    </div>

    <!-- Zone list -->
    <div v-if="state.data && state.data.zones.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
          Hittade {{ state.data.zones.length }} matchande {{ state.data.zones.length === 1 ? 'zon' : 'zoner' }}
        </h2>
        <p v-if="activatedZones.length > 0" class="text-sm text-green-600 dark:text-green-400">
          {{ activatedZones.length }} redan aktiverade
        </p>
      </div>

      <div class="space-y-2">
        <div
          v-for="zone in state.data.zones"
          :key="zone.id"
          class="mod-windows-dns-zone-card flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <input
              v-if="!zone.owned"
              v-model="selectedZoneIds"
              type="checkbox"
              :value="zone.id"
              class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-600"
            />
            <Icon v-else icon="mdi:check-circle" class="h-5 w-5 text-green-500" />
            <Icon icon="mdi:dns" class="h-5 w-5 text-slate-400" />
            <div>
              <p class="font-medium text-slate-900 dark:text-slate-50">{{ zone.zoneName }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ zone.serverName }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="zone.owned" class="mod-windows-dns-badge-owned">
              <Icon icon="mdi:check-circle" class="h-3 w-3" />
              Aktiverad
            </span>
            <span v-else-if="zone.claimable" class="mod-windows-dns-badge-claimable">
              <Icon icon="mdi:hand-pointing-right" class="h-3 w-3" />
              Tillgänglig
            </span>
          </div>
        </div>
      </div>

      <!-- Activate selected button -->
      <div v-if="selectedZoneIds.length > 0" class="flex items-center gap-2 pt-4">
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-600/60 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="state.activating"
          @click="activateSelected"
        >
          <Icon icon="mdi:check" class="h-4 w-4" :class="{ 'animate-pulse': state.activating }" />
          {{ state.activating ? 'Aktiverar...' : `Aktivera valda (${selectedZoneIds.length})` }}
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="state.data && state.data.zones.length === 0"
      class="py-12 text-center"
    >
      <Icon icon="mdi:magnify-close" class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
      <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Inga zoner hittades som matchar ditt COREID
      </p>
      <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">
        Se till att zonerna har en TXT-post med ditt COREID-värde
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

type AutodiscoverZone = {
  id: string
  zoneName: string
  serverId: string
  serverName: string
  zoneType: string
  owned: boolean
  claimable: boolean
  coreIdValue?: string | null
}

type AutodiscoverResponse = {
  zones: AutodiscoverZone[]
  coreId: string
  discoveredAt: string
}

type ActivateResponse = {
  success: boolean
  activatedCount: number
  totalAllowedZones: number
  message: string
}

const state = reactive<{
  data: AutodiscoverResponse | null
  coreId: string | null
  error: string | null
  successMessage: string | null
  pending: boolean
  activating: boolean
}>({
  data: null,
  coreId: null,
  error: null,
  successMessage: null,
  pending: false,
  activating: false
})

const selectedZoneIds = ref<string[]>([])

// Computed: zones that are not yet activated (owned)
const unactivatedZones = computed(() => {
  return state.data?.zones.filter(z => !z.owned) ?? []
})

const activatedZones = computed(() => {
  return state.data?.zones.filter(z => z.owned) ?? []
})

const runAutodiscover = async () => {
  state.pending = true
  state.error = null
  state.successMessage = null
  selectedZoneIds.value = []

  try {
    const res = await $fetch<AutodiscoverResponse>('/api/dns/windows/autodiscover/zones')
    state.data = res
    state.coreId = res.coreId

    // Pre-select all unactivated zones
    selectedZoneIds.value = res.zones.filter(z => !z.owned).map(z => z.id)
  } catch (err: any) {
    state.error = err?.data?.message ?? err?.message ?? 'Autodiscover misslyckades.'
  } finally {
    state.pending = false
  }
}

const activateZones = async (zoneIds: string[]) => {
  if (zoneIds.length === 0) return

  state.activating = true
  state.error = null
  state.successMessage = null

  try {
    // Build zone names map for better display
    const zoneNames: Record<string, string> = {}
    state.data?.zones.forEach(z => {
      if (zoneIds.includes(z.id)) {
        zoneNames[z.id] = z.zoneName
      }
    })

    const res = await $fetch<ActivateResponse>('/api/dns/windows/autodiscover/activate', {
      method: 'POST',
      body: { zoneIds, zoneNames }
    })

    state.successMessage = res.message
    selectedZoneIds.value = []

    // Refresh the list to show updated status
    await runAutodiscover()
  } catch (err: any) {
    state.error = err?.data?.message ?? err?.message ?? 'Aktivering misslyckades.'
  } finally {
    state.activating = false
  }
}

const activateAll = () => {
  const zoneIds = unactivatedZones.value.map(z => z.id)
  activateZones(zoneIds)
}

const activateSelected = () => {
  activateZones(selectedZoneIds.value)
}

// Auto-run autodiscover on mount
onMounted(() => {
  runAutodiscover()
})
</script>


