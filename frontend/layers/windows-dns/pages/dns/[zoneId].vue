<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <!-- Back button -->
    <NuxtLink
      to="/dns"
      class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400 dark:hover:text-brand"
    >
      <Icon icon="mdi:arrow-left" class="h-4 w-4" />
      {{ $t('windowsDns.zone.back') }}
    </NuxtLink>

    <header class="flex flex-col gap-2">
      <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {{ $t('windowsDns.zone.label') }}
      </p>
      <div class="flex flex-col gap-1">
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          <span v-if="zonePending" class="inline-flex items-center gap-2 text-base text-slate-500 dark:text-slate-400">
            <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
            {{ $t('windowsDns.zone.loadingZone') }}
          </span>
          <span v-else>{{ zoneData?.zone?.zoneName ?? '—' }}</span>
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <template v-if="zonePending">
            <span class="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
              {{ $t('windowsDns.zone.loadingStatus') }}
            </span>
          </template>
          <template v-else>
            {{ zoneData?.zone?.serverName }}
          </template>
        </p>
        <div class="flex items-center gap-2">
          <!-- Export zone button -->
          <button
            v-if="zoneId && isValidZoneId && zoneData?.zone"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="exporting"
            @click="exportZone"
          >
            <Icon :icon="exporting ? 'mdi:loading' : 'mdi:download'" :class="{ 'animate-spin': exporting }" class="h-4 w-4" />
            {{ $t('windowsDns.zone.export') }}
          </button>
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
          <p class="font-semibold">{{ $t('windowsDns.zone.errorTitle') }}</p>
          <p class="whitespace-pre-line">{{ zoneError }}</p>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
            @click="refreshAll"
          >
            <Icon icon="mdi:refresh" class="h-4 w-4" />
            {{ $t('windowsDns.zone.retry') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Zone Info Panel (SOA) -->
    <WindowsDnsZoneInfoPanel
      v-if="zoneId && recordsData?.records && soaRecord"
      :zone-name="zoneData?.zone?.zoneName ?? ''"
      :soa-record="soaRecord"
    />

    <!-- Records table (excludes SOA) -->
    <WindowsDnsRecordsTable
      v-if="zoneId && recordsData?.records"
      :zone-id="zoneId"
      :zone-name="zoneData?.zone?.zoneName ?? ''"
      :records="tableRecords"
      :can-edit="recordsData.access?.canEditRecords ?? false"
      @refresh="refreshRecords"
    />

    <!-- Loading state for records -->
    <div v-else-if="recordsPending" class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
      {{ $t('windowsDns.zone.loadingRecords') }}
    </div>

    <!-- Danger Zone -->
    <section
      v-if="zoneId && isValidZoneId && zoneData?.zone && recordsData?.access?.canEditZones"
      class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm dark:border-red-700 dark:bg-red-900/30 dark:text-red-100"
    >
      <header class="mb-2 flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-wide">{{ $t('windowsDns.zone.danger.label') }}</p>
          <p class="text-sm font-semibold">{{ $t('windowsDns.zone.danger.title') }}</p>
          <p class="text-xs text-red-700/90 dark:text-red-100/80">
            {{ $t('windowsDns.zone.danger.description') }}
          </p>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          :disabled="deleting"
          @click="openDeleteModal"
        >
          <Icon icon="mdi:trash-can-outline" class="h-4 w-4" />
          {{ $t('windowsDns.zone.danger.deleteAction') }}
        </button>
      </header>
      <p v-if="deleteError" class="text-xs text-red-700 dark:text-red-200">{{ deleteError }}</p>
    </section>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      >
        <div class="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-xl dark:border-red-700 dark:bg-slate-900">
          <header class="mb-4 space-y-1">
            <p class="text-xs uppercase tracking-wide text-red-600 dark:text-red-200">
              {{ $t('windowsDns.zone.delete.confirmLabel') }}
            </p>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {{ $t('windowsDns.zone.delete.confirmTitle') }}
            </h3>
            <p class="text-sm text-slate-700 dark:text-slate-200">
              {{ $t('windowsDns.zone.delete.confirmDescription') }}
            </p>
          </header>
          <div class="space-y-3">
            <div class="text-sm text-slate-700 dark:text-slate-200">
              <p>{{ $t('windowsDns.zone.delete.enterName') }}</p>
              <input
                v-model="confirmName"
                class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                type="text"
                :placeholder="zoneData?.zone?.zoneName ?? ''"
              />
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input v-model="confirmAck" type="checkbox" />
              <span>{{ $t('windowsDns.zone.delete.ack') }}</span>
            </label>
            <p v-if="deleteError" class="text-xs text-red-700 dark:text-red-200">{{ deleteError }}</p>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
              type="button"
              @click="closeDeleteModal"
            >
              {{ $t('windowsDns.zone.delete.cancel') }}
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              :disabled="deleting || !canDeleteConfirmed"
              @click="confirmDeleteZone"
            >
              <Icon v-if="deleting" icon="mdi:loading" class="h-4 w-4 animate-spin" />
              <Icon v-else icon="mdi:trash-can-outline" class="h-4 w-4" />
              {{ $t('windowsDns.zone.danger.deleteAction') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import WindowsDnsRecordsTable from '@windows-dns/components/WindowsDnsRecordsTable.vue'
import WindowsDnsZoneInfoPanel from '@windows-dns/components/WindowsDnsZoneInfoPanel.vue'
import { useEntityNames } from '~/composables/useEntityNames'

const route = useRoute()
const router = useRouter()
const entityNames = useEntityNames()
const zoneId = computed(() => route.params.zoneId as string)

// Validate that zoneId is a valid UUID
const isValidUuid = (id: string | null | undefined): boolean => {
  if (!id || id === 'null' || id === 'undefined') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

const isValidZoneId = computed(() => isValidUuid(zoneId.value))

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
  access: { canEditRecords: boolean; canEditZones: boolean }
} | null>(null)

// Extract SOA record (case-insensitive) for Zone Info panel
const soaRecord = computed(() => {
  if (!recordsData.value?.records) return null
  return recordsData.value.records.find(
    r => String(r.type ?? '').trim().toUpperCase() === 'SOA'
  ) ?? null
})

// Filter out SOA from table records - SOA is displayed in Zone Info panel instead
const tableRecords = computed(() => {
  if (!recordsData.value?.records) return []
  return recordsData.value.records.filter(
    r => String(r.type ?? '').trim().toUpperCase() !== 'SOA'
  )
})

const fetchZone = async () => {
  // Guard: Don't fetch if zoneId is invalid
  if (!isValidZoneId.value) {
    const { $i18n } = useNuxtApp()
    zoneError.value = $i18n.t('windowsDns.zone.invalidZoneId') ?? 'Invalid zone ID'
    zonePending.value = false
    return
  }

  zonePending.value = true
  zoneError.value = null
  try {
    // Fetch zone info from the zones list and find this zone
    const res = await $fetch<{ zones: any[] }>('/api/dns/windows/zones')
    const zone = res.zones.find(z => z.id === zoneId.value)
    if (zone) {
      zoneData.value = { zone }
      // Cache zone name for breadcrumbs
      if (zone.zoneName) {
        entityNames.setName('zone', zone.id, zone.zoneName)
      }
    } else {
      const { $i18n } = useNuxtApp()
      zoneError.value = $i18n.t('windowsDns.zone.zoneNotFound')
    }
  } catch (err: any) {
    const { $i18n } = useNuxtApp()
    zoneError.value = err?.data?.message ?? err?.message ?? $i18n.t('windowsDns.zone.failedToLoad')
  } finally {
    zonePending.value = false
  }
}

const fetchRecords = async () => {
  // Guard: Don't fetch if zoneId is invalid
  if (!isValidZoneId.value) {
    recordsPending.value = false
    recordsData.value = { records: [], access: { canEditRecords: false, canEditZones: false } }
    return
  }

  recordsPending.value = true
  try {
    const res = await $fetch<{ records: any[]; access: { canEditRecords: boolean } }>(
      `/api/dns/windows/zones/${zoneId.value}/records`
    )
    recordsData.value = res
  } catch (err: any) {
    console.error('Failed to fetch records:', err)
    recordsData.value = { records: [], access: { canEditRecords: false, canEditZones: false } }
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

// Export zone state
const exporting = ref(false)

const exportZone = async () => {
  if (!zoneId.value || !isValidZoneId.value || !zoneData.value?.zone) return
  
  exporting.value = true
  try {
    const content = await $fetch<string>(`/api/dns/windows/zones/${zoneId.value}/export`, {
      responseType: 'text'
    })
    
    // Create and trigger download
    const blob = new Blob([content], { type: 'text/plain' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${zoneData.value.zone.zoneName.replace(/\./g, '_')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
  } catch (err: any) {
    console.error('[windows-dns] Export failed:', err)
    const { $i18n } = useNuxtApp()
    zoneError.value = err?.data?.message ?? err?.message ?? $i18n.t('windowsDns.zone.exportError')
  } finally {
    exporting.value = false
  }
}

// Delete zone state
const deleting = ref(false)
const deleteError = ref<string | null>(null)
const showDeleteModal = ref(false)
const confirmName = ref('')
const confirmAck = ref(false)

const canDeleteConfirmed = computed(() => {
  const expected = zoneData.value?.zone?.zoneName?.trim().toLowerCase() ?? ''
  return confirmAck.value && confirmName.value.trim().toLowerCase() === expected && expected.length > 0
})

const openDeleteModal = () => {
  showDeleteModal.value = true
  confirmName.value = ''
  confirmAck.value = false
  deleteError.value = null
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
  confirmName.value = ''
  confirmAck.value = false
  deleteError.value = null
}

const confirmDeleteZone = async () => {
  if (!zoneId.value || !canDeleteConfirmed.value) return
  deleting.value = true
  deleteError.value = null
  try {
    await $fetch(`/api/dns/windows/zones/${zoneId.value}`, { method: 'DELETE' })
    closeDeleteModal()
    await router.push('/dns')
  } catch (err: any) {
    const { $i18n } = useNuxtApp()
    deleteError.value = err?.data?.message ?? err?.message ?? $i18n.t('windowsDns.zone.delete.error')
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  refreshAll()
})

watch(zoneId, () => {
  refreshAll()
})
</script>

