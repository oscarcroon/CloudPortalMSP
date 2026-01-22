import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { NcentralDevice } from '~/types/ncentral'

const mockDevices: NcentralDevice[] = [
  {
    id: 'nc-1',
    name: 'edge-core-01',
    status: 'online',
    type: 'server',
    osVersion: 'Ubuntu 24.04 LTS',
    region: 'Karlstad',
    lastSeen: '2025-11-22T06:45:00Z',
    organizationId: 'org-coreit'
  },
  {
    id: 'nc-2',
    name: 'dc-monitor-02',
    status: 'warning',
    type: 'appliance',
    osVersion: 'Photon 5.0',
    region: 'Stockholm',
    lastSeen: '2025-11-22T05:55:00Z',
    organizationId: 'org-coreit'
  },
  {
    id: 'nc-3',
    name: 'laptop-anna',
    status: 'online',
    type: 'workstation',
    osVersion: 'Windows 11 23H2',
    region: 'Remote',
    lastSeen: '2025-11-22T07:15:00Z',
    organizationId: 'org-internal'
  },
  {
    id: 'nc-4',
    name: 'fileserver-legacy',
    status: 'offline',
    type: 'server',
    osVersion: 'Windows Server 2016',
    region: 'Göteborg',
    lastSeen: '2025-11-21T18:20:00Z',
    organizationId: 'org-internal'
  }
]

export const useNcentralStore = defineStore('ncentral', () => {
  const devices = ref<NcentralDevice[]>([])
  const isLoading = ref(false)
  const lastUpdated = ref<string | null>(null)

  async function bootstrap() {
    if (!devices.value.length) {
      await fetchDevices()
    }
  }

  async function fetchDevices() {
    const api = useApiClient()
    isLoading.value = true

    try {
      const result = await api<NcentralDevice[]>('/ncentral/devices')
      devices.value = result
    } catch (error) {
      console.warn('Using mock nCentral devices', error)
      devices.value = mockDevices
    } finally {
      lastUpdated.value = new Date().toISOString()
      isLoading.value = false
    }
  }

  const statusBuckets = computed(() => ({
    online: devices.value.filter((device) => device.status === 'online'),
    warning: devices.value.filter((device) => device.status === 'warning'),
    offline: devices.value.filter((device) => device.status === 'offline')
  }))

  const statusSummary = computed(() => ({
    online: statusBuckets.value.online.length,
    warning: statusBuckets.value.warning.length,
    offline: statusBuckets.value.offline.length
  }))

  return {
    devices,
    isLoading,
    lastUpdated,
    statusBuckets,
    statusSummary,
    bootstrap,
    fetchDevices
  }
})


