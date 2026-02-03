<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="flex flex-col gap-2">
        <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ t('cloudflareDns.index.label') }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          {{ t('cloudflareDns.index.title') }}
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('cloudflareDns.index.subtitle') }}
        </p>
        <div class="mt-1 relative w-full max-w-md">
          <Icon icon="mdi:magnify" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchTerm"
            type="search"
            :placeholder="t('cloudflareDns.index.searchPlaceholder')"
            class="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ t('cloudflareDns.index.showing', { visible: pagedZones.length, filtered: filteredZones.length, total: totalZones }) }}
        </p>
      </div>
      <div class="flex items-center gap-2 self-start">
        <button
          class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="coolingDown"
          :title="t('cloudflareDns.index.forceRefreshTitle')"
          @click="forceRefresh"
        >
          <Icon icon="mdi:refresh" class="h-5 w-5" />
        </button>
        <NuxtLink
          to="/cloudflare-dns/admin"
          class="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
        >
          <Icon icon="mdi:cog-outline" class="h-4 w-4" />
          {{ t('cloudflareDns.index.adminLink') }}
        </NuxtLink>
      </div>
    </header>

    <div v-if="state.pending" class="text-sm text-slate-500 dark:text-slate-400">
      {{ t('cloudflareDns.index.loading') }}
    </div>

    <div
      v-else-if="state.error"
      class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <div class="flex items-start gap-3">
        <Icon icon="mdi:alert-circle-outline" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div class="space-y-2">
          <p class="font-semibold">{{ t('cloudflareDns.index.errorTitle') }}</p>
          <p class="whitespace-pre-line">{{ state.error }}</p>
          <div class="flex gap-2">
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
              @click="fetchZones(false)"
            >
              <Icon icon="mdi:refresh" class="h-4 w-4" />
              {{ t('cloudflareDns.index.retry') }}
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
              @click="fetchZones(true)"
            >
              <Icon icon="mdi:refresh-circle" class="h-4 w-4" />
              {{ t('cloudflareDns.index.forceRefresh') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <CloudflareZoneList
      v-else
      :zones="pagedZones"
      :module-rights="state.data?.moduleRights ?? { canManageZones: false }"
      :loading="state.pending"
      @refresh="() => fetchZones(true)"
    />

    <div
      v-if="pageCount > 1"
      class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <span>{{ t('cloudflareDns.index.pagination', { page: currentPage, pages: pageCount }) }}</span>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100"
          :disabled="currentPage === 1"
          @click="currentPage = Math.max(1, currentPage - 1)"
        >
          <Icon icon="mdi:chevron-left" class="h-4 w-4" />
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100"
          :disabled="currentPage === pageCount"
          @click="currentPage = Math.min(pageCount, currentPage + 1)"
        >
          <Icon icon="mdi:chevron-right" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div v-if="state.data?.fromCache" class="text-xs text-slate-500 dark:text-slate-400">
      {{ t('cloudflareDns.index.cached') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CloudflareZoneList from '@cloudflare-dns/components/CloudflareZoneList.vue'
import { useI18n } from '#imports'

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
const searchTerm = ref('')
const pageSize = 20
const currentPage = ref(1)
const { t } = useI18n()

const loadZones = async (forceRefresh = false): Promise<ZonesResponse> => {
  try {
    const res = await ($fetch as any)('/api/dns/cloudflare/zones', {
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

const filteredZones = computed(() => {
  const zones = state.data?.zones ?? []
  const term = searchTerm.value.trim().toLowerCase()
  const filtered = !term
    ? zones
    : zones.filter((z) => {
    const hay = `${z.name ?? ''} ${z.plan ?? ''} ${z.status ?? ''}`.toLowerCase()
    return hay.includes(term)
  })
  currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(filtered.length / pageSize) || 1))
  return filtered
})

const totalZones = computed(() => state.data?.zones?.length ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(filteredZones.value.length / pageSize)))
const pagedZones = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredZones.value.slice(start, start + pageSize)
})

if (process.client) {
  onMounted(() => {
    fetchZones(false)
  })
}
</script>


