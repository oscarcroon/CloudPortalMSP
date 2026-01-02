<template>
  <section class="mod-windows-dns-panel space-y-4">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ $t('windowsDns.zoneList.label') }}
        </p>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
          {{ $t('windowsDns.zoneList.title') }}
        </h2>
      </div>
      <div v-if="moduleRights?.canManageZones" class="flex flex-col gap-2 md:flex-row md:items-center">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
          @click="openCreateModal"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          {{ $t('windowsDns.zoneList.create') }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">
      {{ $t('windowsDns.zoneList.loading') }}
    </div>

    <div v-else-if="zones.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
      {{ $t('windowsDns.zoneList.noZones') }}
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <div
        v-for="zone in zones"
        :key="zone.id"
        class="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-[1px] dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-50">{{ zone.zoneName }}</p>
            <p v-if="zone.serverName" class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {{ zone.serverName }}
            </p>
          </div>
          <span
            v-if="zone.owned"
            class="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300"
          >
            <Icon icon="mdi:check-circle" class="h-3 w-3" />
            {{ $t('windowsDns.zoneList.owned') }}
          </span>
          <span
            v-else-if="zone.claimable"
            class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
          >
            <Icon icon="mdi:hand-pointing-right" class="h-3 w-3" />
            {{ $t('windowsDns.zoneList.claimable') }}
          </span>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <span v-if="recordCounts[zone.id] !== undefined" class="text-xs text-slate-500 dark:text-slate-400">
            {{ recordCounts[zone.id] }} {{ recordCounts[zone.id] === 1 ? $t('windowsDns.zoneList.record') : $t('windowsDns.zoneList.records') }}
          </span>
          <span v-else-if="loadingRecordCounts" class="text-xs text-slate-400 dark:text-slate-500">
            {{ $t('windowsDns.zoneList.loadingRecords') }}
          </span>
          <span v-else class="text-xs text-slate-400 dark:text-slate-500">
            &nbsp;
          </span>
          <NuxtLink
            :to="`/windows-dns/${zone.id}`"
            class="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            {{ $t('windowsDns.zoneList.viewZone') }}
            <Icon icon="mdi:arrow-right" class="h-4 w-4" />
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Create Zone Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      >
        <div class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <header class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneList.onboard.label') }}
              </p>
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
                {{ $t('windowsDns.zoneList.onboard.title') }}
              </h2>
              <p class="text-sm text-slate-600 dark:text-slate-300">
                {{ $t('windowsDns.zoneList.onboard.subtitle') }}
              </p>
            </div>
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
              type="button"
              @click="closeCreateModal"
            >
              {{ $t('windowsDns.zoneList.onboard.cancel') }}
            </button>
          </header>

          <div class="space-y-3">
            <div class="grid gap-2">
              <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
                {{ $t('windowsDns.zoneList.onboard.domainLabel') }}
              </label>
              <input
                v-model="newZone.zoneName"
                class="w-full rounded-lg border-2 border-brand/30 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                type="text"
                :placeholder="$t('windowsDns.zoneList.onboard.domainPlaceholder')"
                required
              />
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p class="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                {{ $t('windowsDns.zoneList.onboard.nameServersTitle') }}
              </p>
              <div class="space-y-2">
                <div
                  v-for="ns in ['ns1.coreit.se', 'ns2.coreit.se', 'ns3.coreit.se']"
                  :key="ns"
                  class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
                >
                  <span class="font-mono text-sm font-medium text-slate-900 dark:text-slate-50">{{ ns }}</span>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand hover:bg-slate-50 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand dark:hover:bg-slate-700"
                    :class="copiedNs === ns ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/20 dark:text-green-300' : ''"
                    @click="copyToClipboard(ns)"
                  >
                    <Icon
                      :icon="copiedNs === ns ? 'mdi:check' : 'mdi:content-copy'"
                      class="h-3.5 w-3.5"
                    />
                    {{ copiedNs === ns ? $t('windowsDns.zoneList.onboard.copied') : $t('windowsDns.zoneList.onboard.copy') }}
                  </button>
                </div>
              </div>
              <p class="mt-3 text-xs text-slate-600 dark:text-slate-400">
                {{ $t('windowsDns.zoneList.onboard.propagation') }}
              </p>
            </div>

            <div
              v-if="createError"
              class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            >
              {{ createError }}
            </div>

            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
                @click="closeCreateModal"
              >
                {{ $t('windowsDns.zoneList.onboard.cancel') }}
              </button>
              <button
                type="button"
                :disabled="creating || !newZone.zoneName || !newZone.serverId"
                class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
                @click="createZone"
              >
                <Icon v-if="creating" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                <Icon v-else icon="mdi:plus-circle-outline" class="h-4 w-4" />
                {{ $t('windowsDns.zoneList.onboard.createZone') }}
              </button>
              <button
                v-if="createdZoneId"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                @click="goToCreatedZone"
              >
                <Icon icon="mdi:arrow-right" class="h-4 w-4" />
                {{ $t('windowsDns.zoneList.onboard.openZone') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

type Zone = {
  id: string
  zoneName: string
  serverId: string
  serverName: string
  zoneType: string
  owned: boolean
  claimable: boolean
}

type Server = {
  id: string
  name: string
  baseUrl: string
  isEnabled: boolean
}

const props = defineProps<{
  zones: Zone[]
  moduleRights?: { canManageZones: boolean }
  loading?: boolean
}>()

const emit = defineEmits<{ refresh: [] }>()
const router = useRouter()

// Record counts state
const recordCounts = ref<Record<string, number>>({})
const loadingRecordCounts = ref(false)

// Fetch record counts for all zones
const fetchRecordCounts = async () => {
  if (props.zones.length === 0) return
  
  loadingRecordCounts.value = true
  try {
    const counts = await Promise.all(
      props.zones.map(async (zone) => {
        try {
          const res = await $fetch<{ records: any[] }>(`/api/dns/windows/zones/${zone.id}/records`)
          return { zoneId: zone.id, count: res.records?.length ?? 0 }
        } catch (err) {
          console.error(`[windows-dns] Failed to fetch record count for zone ${zone.id}:`, err)
          return { zoneId: zone.id, count: 0 }
        }
      })
    )
    
    recordCounts.value = counts.reduce((acc, { zoneId, count }) => {
      acc[zoneId] = count
      return acc
    }, {} as Record<string, number>)
  } catch (err) {
    console.error('[windows-dns] Failed to fetch record counts:', err)
  } finally {
    loadingRecordCounts.value = false
  }
}

// Watch for zone changes and fetch counts
watch(() => props.zones, (newZones) => {
  if (newZones.length > 0) {
    fetchRecordCounts()
  } else {
    recordCounts.value = {}
  }
}, { immediate: true })

// Create zone modal state
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const loadingServers = ref(false)
const servers = ref<Server[]>([])
const createdZoneId = ref<string | null>(null)
const copiedNs = ref<string | null>(null)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

const newZone = reactive({
  zoneName: '',
  serverId: ''
})

const openCreateModal = async () => {
  showCreateModal.value = true
  createError.value = null
  createdZoneId.value = null
  copiedNs.value = null
  newZone.zoneName = ''
  newZone.serverId = ''
  if (copyTimeout) {
    clearTimeout(copyTimeout)
    copyTimeout = null
  }
  
  // Load available servers in background and auto-select first one
  loadingServers.value = true
  try {
    const res = await $fetch<{ servers: Server[] }>('/api/dns/windows/servers')
    servers.value = res.servers || []
    // Automatically select first available server (hidden from UI)
    if (servers.value.length > 0) {
      newZone.serverId = servers.value[0].id
    } else {
      const { $i18n } = useNuxtApp()
      createError.value = $i18n.t('windowsDns.zoneList.onboard.noServersError')
    }
  } catch (err: any) {
    console.error('[windows-dns] Failed to load servers:', err)
    const { $i18n } = useNuxtApp()
    createError.value = err?.data?.message || err?.message || $i18n.t('windowsDns.zoneList.onboard.noServersError')
  } finally {
    loadingServers.value = false
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  createError.value = null
  createdZoneId.value = null
  copiedNs.value = null
  newZone.zoneName = ''
  if (copyTimeout) {
    clearTimeout(copyTimeout)
    copyTimeout = null
  }
}

const createZone = async () => {
  if (!newZone.zoneName || !newZone.serverId) return
  
  creating.value = true
  createError.value = null
  
  try {
    const res = await $fetch<{ zone: { id: string } }>('/api/dns/windows/zones', {
      method: 'POST',
      body: {
        zoneName: newZone.zoneName,
        zoneType: 'Primary', // Always Primary
        serverId: newZone.serverId
      }
    })
    
    createdZoneId.value = res?.zone?.id ?? null
    newZone.zoneName = ''
    emit('refresh')
  } catch (err: any) {
    console.error('[windows-dns] Failed to create zone:', err)
    createError.value = err?.data?.message || err?.message || 'Failed to create zone'
  } finally {
    creating.value = false
  }
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // Show feedback
    copiedNs.value = text
    // Clear any existing timeout
    if (copyTimeout) {
      clearTimeout(copyTimeout)
    }
    // Reset feedback after 2 seconds
    copyTimeout = setTimeout(() => {
      copiedNs.value = null
    }, 2000)
  } catch (err) {
    console.error('[windows-dns] Failed to copy to clipboard:', err)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      // Show feedback even with fallback
      copiedNs.value = text
      if (copyTimeout) {
        clearTimeout(copyTimeout)
      }
      copyTimeout = setTimeout(() => {
        copiedNs.value = null
      }, 2000)
    } catch (fallbackErr) {
      console.error('[windows-dns] Fallback copy failed:', fallbackErr)
    }
    document.body.removeChild(textArea)
  }
}

const goToCreatedZone = () => {
  if (createdZoneId.value) {
    closeCreateModal()
    void router.push(`/windows-dns/${createdZoneId.value}`)
  }
}
</script>

<style scoped>
.mod-windows-dns-panel {
  @apply rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80;
}
</style>

