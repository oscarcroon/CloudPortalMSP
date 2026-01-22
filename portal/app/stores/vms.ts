import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import type { VmInstance } from '~/types/vms'

const mockVms: VmInstance[] = [
  {
    id: 'vm-1',
    name: 'edge-router-01',
    powerState: 'poweredOn',
    cpu: '4',
    memory: '8GB',
    disk: '120GB',
    platform: 'ESXi',
    organizationId: 'org-coreit'
  },
  {
    id: 'vm-2',
    name: 'wordpress-ha-01',
    powerState: 'poweredOff',
    cpu: '2',
    memory: '4GB',
    disk: '80GB',
    platform: 'Morpheus',
    organizationId: 'org-internal'
  }
]

export const useVmStore = defineStore('vms', () => {
  const items = ref<VmInstance[]>([])
  const filter = reactive({
    powerState: ''
  })

  async function bootstrap() {
    if (!items.value.length) {
      await refresh()
    }
  }

  async function refresh() {
    const api = useApiClient()
    try {
      items.value = await api<VmInstance[]>('/vms')
    } catch (error) {
      console.warn('Using mock VMs', error)
      items.value = mockVms
    }
  }

  function power(id: string, action: 'start' | 'stop' | 'reboot') {
    console.log(`Would ${action} VM ${id}`)
  }

  const filteredVms = computed(() => {
    return items.value.filter((vm) => {
      if (!filter.powerState) return true
      return vm.powerState === filter.powerState
    })
  })

  return {
    items,
    filter,
    filteredVms,
    bootstrap,
    refresh,
    power
  }
})

