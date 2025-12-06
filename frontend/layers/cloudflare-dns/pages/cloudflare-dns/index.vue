<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Cloudflare</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">DNS-zoner</h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Förenklat gränssnitt för zoner och DNS records. Behörigheter styrs av modulroller och zon-ACL.
        </p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="coolingDown"
          @click="forceRefresh"
        >
          <Icon icon="mdi:refresh" class="h-4 w-4" />
          Tvinga uppdatering
        </button>
        <NuxtLink
          to="/cloudflare-dns/admin"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
        >
          <Icon icon="mdi:cog-outline" class="h-4 w-4" />
          Admin
        </NuxtLink>
      </div>
    </header>

    <div v-if="state.pending" class="text-sm text-slate-500 dark:text-slate-400">Laddar zoner...</div>

    <div
      v-else-if="state.error"
      class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <div class="flex items-start gap-3">
        <Icon icon="mdi:alert-circle-outline" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div class="space-y-2">
          <p class="font-semibold">Kunde inte hämta zoner</p>
          <p class="whitespace-pre-line">{{ state.error }}</p>
          <div class="flex gap-2">
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
              @click="fetchZones(false)"
            >
              <Icon icon="mdi:refresh" class="h-4 w-4" />
              Försök igen
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
              @click="fetchZones(true)"
            >
              <Icon icon="mdi:refresh-circle" class="h-4 w-4" />
              Tvinga uppdatering
            </button>
          </div>
        </div>
      </div>
    </div>

    <CloudflareZoneList
      v-else
      :zones="state.data?.zones ?? []"
      :module-rights="state.data?.moduleRights ?? { canManageZones: false }"
      :loading="state.pending"
      @refresh="() => fetchZones(true)"
    />

    <div v-if="state.data?.fromCache" class="text-xs text-slate-500 dark:text-slate-400">
      Visar cachelagrade zoner. För att hämta färska data, klicka ”Tvinga uppdatering”.
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CloudflareZoneList from '@cloudflare-dns/components/CloudflareZoneList.vue'

type ZonesResponse = {
  zones: any[]
  moduleRights: { canManageZones: boolean; canEditRecords?: boolean; canManageAcls?: boolean; canManageOrgConfig?: boolean }
  fromCache?: boolean
  stale?: boolean
}

const state = reactive<{
  data: ZonesResponse | null
  error: string | null
  pending: boolean
}>({
  data: null,
  error: null,
  pending: true
})

const coolingDown = ref(false)
let cooldownTimer: ReturnType<typeof setTimeout> | null = null

const loadZones = async (forceRefresh = false): Promise<ZonesResponse> => {
  try {
    const res = await $fetch<ZonesResponse>('/api/dns/cloudflare/zones', {
      query: forceRefresh ? { refresh: 'true' } : undefined
    })
    return res
  } catch (err: any) {
    const message = err?.data?.message ?? err?.message ?? 'Kunde inte hämta zoner.'
    return {
      zones: [],
      moduleRights: { canManageZones: false },
      fromCache: false,
      stale: false,
      // @ts-expect-error keep for UI
      error: message
    }
  }
}

const fetchZones = async (forceRefresh = false) => {
  state.pending = true
  state.error = null
  const res = await loadZones(forceRefresh)
  if ((res as any).error) {
    state.error = (res as any).error
    state.data = { zones: [], moduleRights: { canManageZones: false } }
  } else {
    state.data = res
  }
  state.pending = false
}

const forceRefresh = async () => {
  if (coolingDown.value) return
  coolingDown.value = true
  await fetchZones(true)
  if (cooldownTimer) clearTimeout(cooldownTimer)
  cooldownTimer = setTimeout(() => {
    coolingDown.value = false
  }, 2000)
}

if (process.client) {
  onMounted(() => {
    fetchZones(false)
  })
}
</script>


