<template>
  <section class="mod-windows-dns-panel space-y-4">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          DNS Zones
        </p>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Windows DNS Zones
        </h2>
      </div>
      <div v-if="moduleRights?.canManageZones" class="flex flex-col gap-2 md:flex-row md:items-center">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
          @click="openCreateModal"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Create Zone
        </button>
      </div>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">
      Loading zones...
    </div>

    <div v-else-if="zones.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
      No zones found.
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="zone in zones"
        :key="zone.id"
        class="mod-windows-dns-zone-card group"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <Icon icon="mdi:dns" class="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <NuxtLink
                :to="`/windows-dns/${zone.id}`"
                class="font-medium text-slate-900 hover:text-brand dark:text-slate-50"
              >
                {{ zone.zoneName }}
              </NuxtLink>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ zone.serverName }} &middot; {{ zone.zoneType }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span v-if="zone.owned" class="mod-windows-dns-badge-owned">
              <Icon icon="mdi:check-circle" class="h-3 w-3" />
              Owned
            </span>
            <span v-else-if="zone.claimable" class="mod-windows-dns-badge-claimable">
              <Icon icon="mdi:hand-pointing-right" class="h-3 w-3" />
              Claimable
            </span>

            <NuxtLink
              :to="`/windows-dns/${zone.id}`"
              class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 opacity-0 transition group-hover:opacity-100 hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
            >
              <Icon icon="mdi:dns-outline" class="h-3.5 w-3.5" />
              Records
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Zone Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      >
        <div class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <header class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                New Zone
              </p>
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
                Create DNS Zone
              </h2>
              <p class="text-sm text-slate-600 dark:text-slate-300">
                Create a new DNS zone on Windows DNS server.
              </p>
            </div>
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
              type="button"
              @click="closeCreateModal"
            >
              Cancel
            </button>
          </header>

          <form class="space-y-4" @submit.prevent="createZone">
            <div class="grid gap-2">
              <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
                Domain Name
              </label>
              <input
                v-model="newZone.zoneName"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                type="text"
                placeholder="example.com"
                required
              />
            </div>

            <div class="grid gap-2">
              <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
                Zone Type
              </label>
              <select
                v-model="newZone.zoneType"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                required
              >
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
                <option value="Stub">Stub</option>
              </select>
            </div>

            <div class="grid gap-2">
              <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
                DNS Server
              </label>
              <select
                v-model="newZone.serverId"
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                required
                :disabled="loadingServers"
              >
                <option v-if="loadingServers" value="" disabled>Loading servers...</option>
                <option v-else-if="servers.length === 0" value="" disabled>No servers available</option>
                <option v-for="server in servers" :key="server.id" :value="server.id">
                  {{ server.name }}
                </option>
              </select>
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
                Cancel
              </button>
              <button
                type="submit"
                :disabled="creating || !newZone.zoneName || !newZone.serverId"
                class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon v-if="creating" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                <Icon v-else icon="mdi:plus-circle-outline" class="h-4 w-4" />
                Create Zone
              </button>
            </div>
          </form>
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

// Create zone modal state
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const loadingServers = ref(false)
const servers = ref<Server[]>([])

const newZone = reactive({
  zoneName: '',
  zoneType: 'Primary',
  serverId: ''
})

const openCreateModal = async () => {
  showCreateModal.value = true
  createError.value = null
  newZone.zoneName = ''
  newZone.zoneType = 'Primary'
  newZone.serverId = ''
  
  // Load available servers
  loadingServers.value = true
  try {
    const res = await $fetch<{ servers: Server[] }>('/api/dns/windows/servers')
    servers.value = res.servers || []
    if (servers.value.length > 0) {
      newZone.serverId = servers.value[0].id
    }
  } catch (err: any) {
    console.error('[windows-dns] Failed to load servers:', err)
    createError.value = err?.data?.message || err?.message || 'Failed to load servers'
  } finally {
    loadingServers.value = false
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  createError.value = null
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
        zoneType: newZone.zoneType,
        serverId: newZone.serverId
      }
    })
    
    closeCreateModal()
    emit('refresh')
    
    // Navigate to the new zone
    if (res?.zone?.id) {
      await router.push(`/windows-dns/${res.zone.id}`)
    }
  } catch (err: any) {
    console.error('[windows-dns] Failed to create zone:', err)
    createError.value = err?.data?.message || err?.message || 'Failed to create zone'
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.mod-windows-dns-panel {
  @apply rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80;
}
</style>

