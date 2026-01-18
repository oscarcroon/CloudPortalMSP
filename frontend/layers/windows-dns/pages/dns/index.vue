<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="flex flex-col gap-2">
        <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ $t('windowsDns.index.label') }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          {{ $t('windowsDns.index.title') }}
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ $t('windowsDns.index.subtitle') }}
        </p>
        <div class="mt-1 relative w-full max-w-md">
          <Icon icon="mdi:magnify" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchTerm"
            type="search"
            :placeholder="$t('windowsDns.index.searchPlaceholder')"
            class="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>
        <p v-if="state.data" class="text-xs text-slate-500 dark:text-slate-400">
          {{ $t('windowsDns.index.showing', { filtered: filteredZones.length, total: state.data.zones.length }) }}
        </p>
      </div>
      <div class="flex items-center gap-2 self-start">
        <button
          class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="state.pending"
          :title="$t('windowsDns.index.refreshTitle')"
          @click="fetchZones(true)"
        >
          <Icon icon="mdi:refresh" class="h-5 w-5" :class="{ 'animate-spin': state.pending }" />
        </button>
        <!-- Redirects button -->
        <NuxtLink
          to="/dns/redirects"
          class="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
        >
          <Icon icon="mdi:redirect" class="h-4 w-4" />
          {{ $t('windowsDns.redirects.title') }}
        </NuxtLink>
        <!-- Manage zones button - only for admins -->
        <button
          v-if="state.data?.moduleRights?.canManageOwnership"
          class="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
          @click="showManageModal = true"
        >
          <Icon icon="mdi:cog" class="h-4 w-4" />
          {{ $t('windowsDns.index.manageZones') }}
        </button>
      </div>
    </header>

    <!-- Auto-setup success message -->
    <div
      v-if="state.autoSetupMessage && !state.error"
      class="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-sm dark:border-green-500/60 dark:bg-green-500/10 dark:text-green-100"
    >
      <div class="flex items-center gap-2">
        <Icon icon="mdi:check-circle" class="h-5 w-5 flex-shrink-0" />
        <p>{{ state.autoSetupMessage }}</p>
      </div>
    </div>

    <!-- Needs admin setup message -->
    <div
      v-if="state.needsAdminSetup && state.data?.zones.length === 0 && !state.error"
      class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <div class="flex items-center gap-2">
        <Icon icon="mdi:information-outline" class="h-5 w-5 flex-shrink-0" />
        <p>{{ $t('windowsDns.index.needsAdminSetup') }}</p>
      </div>
    </div>

    <div v-if="state.pending && !state.data" class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
      {{ $t('windowsDns.index.loading') }}
    </div>

    <div
      v-else-if="state.error"
      class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <div class="flex items-start gap-3">
        <Icon icon="mdi:alert-circle-outline" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div class="space-y-2">
          <p class="font-semibold">{{ $t('windowsDns.index.errorTitle') }}</p>
          <p class="whitespace-pre-line">{{ state.error }}</p>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
            @click="fetchZones(true)"
          >
            <Icon icon="mdi:refresh" class="h-4 w-4" />
            {{ $t('windowsDns.index.retry') }}
          </button>
        </div>
      </div>
    </div>

    <WindowsDnsZoneList
      v-else-if="state.data"
      :zones="filteredZones"
      :module-rights="state.data?.moduleRights"
      :loading="state.pending"
      @refresh="fetchZones(true)"
    />

    <div v-if="state.data && filteredZones.length === 0 && !state.pending && !state.needsAdminSetup" class="text-center py-12">
      <Icon icon="mdi:dns-outline" class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
      <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">
        {{ searchTerm ? $t('windowsDns.index.noZonesFoundWithSearch', { searchTerm }) : $t('windowsDns.index.noZonesFound') }}
      </p>
    </div>

    <!-- Manage zones modal -->
    <WindowsDnsManageZonesModal
      :show="showManageModal"
      @close="showManageModal = false"
      @updated="fetchZones(true)"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import WindowsDnsManageZonesModal from '@windows-dns/components/WindowsDnsManageZonesModal.vue'

type Zone = {
  id: string
  zoneName: string
  serverId: string
  serverName: string
  zoneType: string
  owned: boolean
  claimable: boolean
}

type AutoSetupInfo = {
  performed: boolean
  zonesActivated: number
  autoHealed?: boolean
  message?: string
}

type ZonesResponse = {
  zones: Zone[]
  autoSetup?: AutoSetupInfo
  needsAdminSetup?: boolean
  moduleRights: {
    canManageZones: boolean
    canEditRecords: boolean
    canAutodiscover: boolean
    canManageOwnership?: boolean
  }
}

const state = reactive<{
  data: ZonesResponse | null
  error: string | null
  pending: boolean
  autoSetupMessage: string | null
  needsAdminSetup: boolean
}>({
  data: null,
  error: null,
  pending: true,
  autoSetupMessage: null,
  needsAdminSetup: false
})

const searchTerm = ref('')
const showManageModal = ref(false)

const filteredZones = computed(() => {
  const zones = state.data?.zones ?? []
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return zones
  return zones.filter((z) => z.zoneName.toLowerCase().includes(term))
})

const fetchZones = async (forceRefresh = false) => {
  state.pending = true
  state.error = null
  state.autoSetupMessage = null
  state.needsAdminSetup = false
  try {
    const res = await $fetch<ZonesResponse>('/api/dns/windows/zones', {
      query: forceRefresh ? { refresh: 'true' } : undefined
    })
    state.data = res
    state.needsAdminSetup = res.needsAdminSetup ?? false
    
    // Show feedback if auto-setup was performed
    if (res.autoSetup?.performed) {
      if (res.autoSetup.zonesActivated > 0) {
        const { $i18n } = useNuxtApp()
        const count = res.autoSetup.zonesActivated
        const zoneWord = count === 1 
          ? ($i18n.locale === 'sv' ? 'zon' : 'zone')
          : ($i18n.locale === 'sv' ? 'zoner' : 'zones')
        state.autoSetupMessage = $i18n.t('windowsDns.index.autoSetupMessage', { count, zoneWord })
      } else if (res.autoSetup.message) {
        state.autoSetupMessage = res.autoSetup.message
      }
    }
  } catch (err: any) {
    const { $i18n } = useNuxtApp()
    state.error = err?.data?.message ?? err?.message ?? $i18n.t('windowsDns.index.errorTitle')
  } finally {
    state.pending = false
  }
}

onMounted(() => {
  fetchZones(false)
})
</script>
