<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <!-- Header -->
        <header class="flex items-start justify-between gap-3 border-b border-slate-200 p-6 dark:border-slate-700">
          <div>
            <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
              {{ $t('windowsDns.manageZones.title') }}
            </h2>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              {{ $t('windowsDns.manageZones.subtitle') }}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            @click="emit('close')"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </header>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Loading state -->
          <div v-if="state.loading" class="flex items-center justify-center py-12">
            <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
            <span class="ml-3 text-sm text-slate-500">{{ $t('windowsDns.manageZones.loading') }}</span>
          </div>

          <!-- Error state -->
          <div
            v-else-if="state.error"
            class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
          >
            <div class="flex items-start gap-2">
              <Icon icon="mdi:alert-circle" class="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p>{{ state.error }}</p>
                <button
                  class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:underline dark:text-red-300"
                  @click="loadZones"
                >
                  <Icon icon="mdi:refresh" class="h-4 w-4" />
                  {{ $t('windowsDns.manageZones.retry') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Content loaded -->
          <template v-else>
            <!-- COREID info -->
            <div
              v-if="state.coreId"
              class="mb-4 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-3 dark:border-brand/30 dark:bg-brand/10"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <Icon icon="mdi:information-outline" class="h-4 w-4 text-brand" />
                  {{ $t('windowsDns.manageZones.coreIdInfo') }}
                  <code class="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">{{ state.coreId }}</code>
                </div>
                <button
                  class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
                  :disabled="state.rescanning"
                  @click="loadZones"
                >
                  <Icon icon="mdi:refresh" class="h-3.5 w-3.5" :class="{ 'animate-spin': state.rescanning }" />
                  {{ state.rescanning ? $t('windowsDns.manageZones.rescanning') : $t('windowsDns.manageZones.rescan') }}
                </button>
              </div>
            </div>

            <!-- Tabs -->
            <div class="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition"
                :class="activeTab === tab.key 
                  ? 'bg-white text-brand shadow-sm dark:bg-slate-900' 
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'"
                @click="activeTab = tab.key"
              >
                {{ tab.label }}
                <span class="ml-1 text-xs text-slate-400">({{ tab.count }})</span>
              </button>
            </div>

            <!-- Success message -->
            <div
              v-if="state.successMessage"
              class="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200"
            >
              <div class="flex items-center gap-2">
                <Icon icon="mdi:check-circle" class="h-4 w-4" />
                {{ state.successMessage }}
              </div>
            </div>

            <!-- Zone list -->
            <div v-if="filteredZones.length > 0" class="space-y-2">
              <div
                v-for="zone in filteredZones"
                :key="zone.id"
                class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
              >
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    v-model="selectedZoneIds"
                    type="checkbox"
                    :value="zone.id"
                    class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-600"
                  />
                  <Icon icon="mdi:dns" class="h-5 w-5 flex-shrink-0 text-slate-400" />
                  <div class="min-w-0">
                    <p class="truncate font-medium text-slate-900 dark:text-slate-50">{{ zone.zoneName }}</p>
                    <p v-if="zone.serverName" class="text-xs text-slate-500 dark:text-slate-400">{{ zone.serverName }}</p>
                  </div>
                </div>
                <span
                  class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium"
                  :class="statusClasses[zone.status]"
                >
                  <Icon :icon="statusIcons[zone.status]" class="h-3 w-3" />
                  {{ $t(`windowsDns.manageZones.status.${zone.status}`) }}
                </span>
              </div>
            </div>

            <!-- Empty state -->
            <div v-else class="py-12 text-center">
              <Icon icon="mdi:dns-outline" class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.manageZones.noZonesFound') }}
              </p>
              <p v-if="state.coreId" class="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {{ $t('windowsDns.manageZones.noZonesHint', { coreId: state.coreId }) }}
              </p>
            </div>
          </template>
        </div>

        <!-- Footer with actions -->
        <footer
          v-if="!state.loading && !state.error && selectedZoneIds.length > 0"
          class="flex items-center justify-between gap-3 border-t border-slate-200 p-4 dark:border-slate-700"
        >
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ selectedZoneIds.length }} {{ selectedZoneIds.length === 1 ? $t('windowsDns.manageZones.zoneWord.one') : $t('windowsDns.manageZones.zoneWord.other') }}
          </p>
          <div class="flex gap-2">
            <!-- Delete button for allowed zones -->
            <button
              v-if="canDeleteSelected"
              class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:-translate-y-[1px] hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300"
              :disabled="state.processing"
              @click="openDeleteConfirmation"
            >
              <Icon icon="mdi:trash-can-outline" class="h-4 w-4" />
              {{ $t('windowsDns.manageZones.actions.delete') }}
            </button>
            <!-- Show Hide button for allowed zones -->
            <button
              v-if="canHideSelected"
              class="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:-translate-y-[1px] hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
              :disabled="state.processing"
              @click="hideSelected"
            >
              <Icon icon="mdi:eye-off" class="h-4 w-4" :class="{ 'animate-pulse': state.processing }" />
              {{ $t('windowsDns.manageZones.actions.hide') }}
            </button>
            <!-- Show Activate/Show button for available/blocked zones -->
            <button
              v-if="canShowSelected"
              class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="state.processing"
              @click="showSelected"
            >
              <Icon icon="mdi:eye" class="h-4 w-4" :class="{ 'animate-pulse': state.processing }" />
              {{ hasBlockedSelected ? $t('windowsDns.manageZones.actions.show') : $t('windowsDns.manageZones.actions.activate') }}
            </button>
          </div>
        </footer>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="deleteState.showConfirm"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-4 py-6"
    >
      <div class="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-xl dark:border-red-700 dark:bg-slate-900">
        <header class="mb-4 space-y-1">
          <p class="text-xs uppercase tracking-wide text-red-600 dark:text-red-200">
            {{ $t('windowsDns.manageZones.delete.confirmLabel') }}
          </p>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {{ $t('windowsDns.manageZones.delete.confirmTitle') }}
          </h3>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            {{ $t('windowsDns.manageZones.delete.confirmDescription', { count: zonesToDelete.length }) }}
          </p>
        </header>
        <div class="space-y-3">
          <!-- List zones to delete -->
          <div class="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-700 dark:bg-red-900/20">
            <ul class="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <li v-for="zone in zonesToDelete" :key="zone.id" class="flex items-center gap-2">
                <Icon icon="mdi:dns" class="h-4 w-4 text-red-500" />
                {{ zone.zoneName }}
              </li>
            </ul>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input v-model="deleteState.confirmed" type="checkbox" />
            <span>{{ $t('windowsDns.manageZones.delete.ack') }}</span>
          </label>
          <p v-if="deleteState.error" class="text-xs text-red-700 dark:text-red-200">{{ deleteState.error }}</p>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
            type="button"
            @click="closeDeleteConfirmation"
          >
            {{ $t('windowsDns.manageZones.delete.cancel') }}
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
            type="button"
            :disabled="deleteState.deleting || !deleteState.confirmed"
            @click="confirmDeleteZones"
          >
            <Icon v-if="deleteState.deleting" icon="mdi:loading" class="h-4 w-4 animate-spin" />
            <Icon v-else icon="mdi:trash-can-outline" class="h-4 w-4" />
            {{ $t('windowsDns.manageZones.actions.delete') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

type ZoneStatus = 'allowed' | 'available' | 'blocked'

type ManagedZone = {
  id: string
  zoneName: string
  serverId: string
  serverName: string
  zoneType: string
  owned: boolean
  claimable: boolean
  status: ZoneStatus
}

type ManageResponse = {
  zones: ManagedZone[]
  allowedZoneIds: string[]
  blockedZoneIds: string[]
  coreId: string
}

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const state = reactive<{
  loading: boolean
  rescanning: boolean
  processing: boolean
  error: string | null
  successMessage: string | null
  zones: ManagedZone[]
  coreId: string | null
}>({
  loading: true,
  rescanning: false,
  processing: false,
  error: null,
  successMessage: null,
  zones: [],
  coreId: null
})

const selectedZoneIds = ref<string[]>([])
const activeTab = ref<'all' | 'allowed' | 'available' | 'blocked'>('all')

// Delete confirmation state
const deleteState = reactive<{
  showConfirm: boolean
  confirmed: boolean
  deleting: boolean
  error: string | null
}>({
  showConfirm: false,
  confirmed: false,
  deleting: false,
  error: null
})

const statusClasses: Record<ZoneStatus, string> = {
  allowed: 'border border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300',
  available: 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  blocked: 'border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
}

const statusIcons: Record<ZoneStatus, string> = {
  allowed: 'mdi:check-circle',
  available: 'mdi:plus-circle',
  blocked: 'mdi:eye-off'
}

const tabs = computed(() => [
  { key: 'all' as const, label: $t('windowsDns.manageZones.tabs.all'), count: state.zones.length },
  { key: 'allowed' as const, label: $t('windowsDns.manageZones.tabs.allowed'), count: state.zones.filter(z => z.status === 'allowed').length },
  { key: 'available' as const, label: $t('windowsDns.manageZones.tabs.available'), count: state.zones.filter(z => z.status === 'available').length },
  { key: 'blocked' as const, label: $t('windowsDns.manageZones.tabs.blocked'), count: state.zones.filter(z => z.status === 'blocked').length }
])

const filteredZones = computed(() => {
  if (activeTab.value === 'all') return state.zones
  return state.zones.filter(z => z.status === activeTab.value)
})

const selectedZones = computed(() => state.zones.filter(z => selectedZoneIds.value.includes(z.id)))

const canHideSelected = computed(() => selectedZones.value.some(z => z.status === 'allowed'))

const canShowSelected = computed(() => selectedZones.value.some(z => z.status === 'available' || z.status === 'blocked'))

const hasBlockedSelected = computed(() => selectedZones.value.some(z => z.status === 'blocked'))

// Can delete only allowed zones (zones we have access to)
const canDeleteSelected = computed(() => selectedZones.value.some(z => z.status === 'allowed'))

const zonesToDelete = computed(() => selectedZones.value.filter(z => z.status === 'allowed'))

const { $i18n } = useNuxtApp()
const $t = $i18n.t.bind($i18n)

const loadZones = async () => {
  state.loading = !state.zones.length
  state.rescanning = state.zones.length > 0
  state.error = null
  state.successMessage = null
  selectedZoneIds.value = []

  try {
    const res = await ($fetch as any)('/api/dns/windows/zones/manage') as ManageResponse
    state.zones = res.zones
    state.coreId = res.coreId
  } catch (err: any) {
    state.error = err?.data?.message ?? err?.message ?? $t('windowsDns.manageZones.error')
  } finally {
    state.loading = false
    state.rescanning = false
  }
}

const hideSelected = async () => {
  const zonesToHide = selectedZones.value.filter(z => z.status === 'allowed')
  if (zonesToHide.length === 0) return

  state.processing = true
  state.successMessage = null

  try {
    const zoneIds = zonesToHide.map(z => z.id)
    const zoneNames: Record<string, string> = {}
    zonesToHide.forEach(z => { zoneNames[z.id] = z.zoneName })

    await ($fetch as any)('/api/dns/windows/zones/block', {
      method: 'POST',
      body: { zoneIds, zoneNames }
    })

    const zoneWord = zoneIds.length === 1 
      ? $t('windowsDns.manageZones.zoneWord.one') 
      : $t('windowsDns.manageZones.zoneWord.other')
    state.successMessage = $t('windowsDns.manageZones.success.hidden', { count: zoneIds.length, zoneWord })

    selectedZoneIds.value = []
    await loadZones()
    emit('updated')
  } catch (err: any) {
    state.error = err?.data?.message ?? err?.message ?? 'Failed to hide zones'
  } finally {
    state.processing = false
  }
}

const showSelected = async () => {
  const zonesToShow = selectedZones.value.filter(z => z.status === 'available' || z.status === 'blocked')
  if (zonesToShow.length === 0) return

  state.processing = true
  state.successMessage = null

  try {
    const blockedZoneIds = zonesToShow.filter(z => z.status === 'blocked').map(z => z.id)
    const availableZoneIds = zonesToShow.filter(z => z.status === 'available').map(z => z.id)

    const zoneNames: Record<string, string> = {}
    zonesToShow.forEach(z => { zoneNames[z.id] = z.zoneName })

    // Unblock blocked zones
    if (blockedZoneIds.length > 0) {
      await ($fetch as any)('/api/dns/windows/zones/unblock', {
        method: 'POST',
        body: { zoneIds: blockedZoneIds, activate: true, zoneNames }
      })
    }

    // Activate available zones (not blocked) - use unblock with activate
    if (availableZoneIds.length > 0) {
      await ($fetch as any)('/api/dns/windows/zones/unblock', {
        method: 'POST',
        body: { zoneIds: availableZoneIds, activate: true, zoneNames }
      })
    }

    const totalCount = zonesToShow.length
    const zoneWord = totalCount === 1 
      ? $t('windowsDns.manageZones.zoneWord.one') 
      : $t('windowsDns.manageZones.zoneWord.other')
    state.successMessage = $t('windowsDns.manageZones.success.shown', { count: totalCount, zoneWord })

    selectedZoneIds.value = []
    await loadZones()
    emit('updated')
  } catch (err: any) {
    state.error = err?.data?.message ?? err?.message ?? 'Failed to show zones'
  } finally {
    state.processing = false
  }
}

// Delete zone functions
const openDeleteConfirmation = () => {
  if (zonesToDelete.value.length === 0) return
  deleteState.showConfirm = true
  deleteState.confirmed = false
  deleteState.error = null
}

const closeDeleteConfirmation = () => {
  deleteState.showConfirm = false
  deleteState.confirmed = false
  deleteState.error = null
}

const confirmDeleteZones = async () => {
  if (!deleteState.confirmed || zonesToDelete.value.length === 0) return

  deleteState.deleting = true
  deleteState.error = null

  try {
    // Delete zones one by one
    const deletePromises = zonesToDelete.value.map(zone =>
      ($fetch as any)(`/api/dns/windows/zones/${zone.id}`, { method: 'DELETE' })
    )
    
    await Promise.all(deletePromises)

    const count = zonesToDelete.value.length
    const zoneWord = count === 1 
      ? $t('windowsDns.manageZones.zoneWord.one') 
      : $t('windowsDns.manageZones.zoneWord.other')
    state.successMessage = $t('windowsDns.manageZones.success.deleted', { count, zoneWord })

    closeDeleteConfirmation()
    selectedZoneIds.value = []
    await loadZones()
    emit('updated')
  } catch (err: any) {
    deleteState.error = err?.data?.message ?? err?.message ?? $t('windowsDns.manageZones.delete.error')
  } finally {
    deleteState.deleting = false
  }
}

// Watch for modal open
watch(() => props.show, (newVal) => {
  if (newVal) {
    loadZones()
  } else {
    // Reset state when closing
    state.successMessage = null
    selectedZoneIds.value = []
    closeDeleteConfirmation()
  }
}, { immediate: true })
</script>

