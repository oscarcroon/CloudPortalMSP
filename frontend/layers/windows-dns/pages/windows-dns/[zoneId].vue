<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2">
      <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Windows DNS Zone
      </p>
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
            <span v-if="zonePending" class="inline-flex items-center gap-2 text-base text-slate-500 dark:text-slate-400">
              <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
              Loading zone...
            </span>
            <span v-else>{{ zoneData?.zone?.zoneName ?? '—' }}</span>
          </h1>
          <NuxtLink
            to="/windows-dns"
            class="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            <Icon icon="mdi:arrow-left" class="h-4 w-4" />
            Back to zones
          </NuxtLink>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <template v-if="zonePending">
            <span class="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
              Loading status...
            </span>
          </template>
          <template v-else>
            {{ zoneData?.zone?.serverName }} &middot; {{ zoneData?.zone?.zoneType ?? 'Primary' }}
          </template>
        </p>
        <div class="flex items-center gap-2">
          <span class="mod-windows-dns-badge">
            <Icon icon="mdi:dns" class="h-4 w-4" />
            Windows DNS
          </span>
        </div>
      </div>
    </header>

    <!-- Error state -->
    <div
      v-if="zoneError"
      class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <div class="flex items-start gap-3">
        <Icon icon="mdi:alert-circle-outline" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div class="space-y-2">
          <p class="font-semibold">Error loading zone</p>
          <p class="whitespace-pre-line">{{ zoneError }}</p>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
            @click="refreshAll"
          >
            <Icon icon="mdi:refresh" class="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    </div>

    <!-- Records table -->
    <WindowsDnsRecordsTable
      v-if="zoneId && recordsData?.records"
      :zone-id="zoneId"
      :zone-name="zoneData?.zone?.zoneName ?? ''"
      :records="recordsData.records"
      :can-edit="recordsData.access?.canEditRecords ?? false"
      @refresh="refreshRecords"
    />

    <!-- Loading state for records -->
    <div v-else-if="recordsPending" class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
      Loading records...
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import WindowsDnsRecordsTable from '@windows-dns/components/WindowsDnsRecordsTable.vue'

const route = useRoute()
const zoneId = computed(() => route.params.zoneId as string)

const zonePending = ref(true)
const zoneError = ref<string | null>(null)
const zoneData = ref<{
  zone: {
    id: string
    zoneName: string
    serverName: string
    zoneType: string
  } | null
} | null>(null)

const recordsPending = ref(true)
const recordsData = ref<{
  records: any[]
  access: { canEditRecords: boolean }
} | null>(null)

const fetchZone = async () => {
  zonePending.value = true
  zoneError.value = null
  try {
    // Fetch zone info from the zones list and find this zone
    const res = await $fetch<{ zones: any[] }>('/api/dns/windows/zones')
    const zone = res.zones.find(z => z.id === zoneId.value)
    if (zone) {
      zoneData.value = { zone }
    } else {
      zoneError.value = 'Zone not found'
    }
  } catch (err: any) {
    zoneError.value = err?.data?.message ?? err?.message ?? 'Failed to load zone'
  } finally {
    zonePending.value = false
  }
}

const fetchRecords = async () => {
  recordsPending.value = true
  try {
    const res = await $fetch<{ records: any[]; access: { canEditRecords: boolean } }>(
      `/api/dns/windows/zones/${zoneId.value}/records`
    )
    recordsData.value = res
  } catch (err: any) {
    console.error('Failed to fetch records:', err)
    recordsData.value = { records: [], access: { canEditRecords: false } }
  } finally {
    recordsPending.value = false
  }
}

const refreshRecords = async () => {
  await fetchRecords()
}

const refreshAll = async () => {
  await Promise.all([fetchZone(), fetchRecords()])
}

onMounted(() => {
  refreshAll()
})

watch(zoneId, () => {
  refreshAll()
})
</script>

