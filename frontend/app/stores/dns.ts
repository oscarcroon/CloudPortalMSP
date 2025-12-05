import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CreateDnsRecordPayload, DnsRecord, DnsZone } from '~/types/dns'

const mockZones: DnsZone[] = [
  { id: 'zone-1', name: 'example.com', status: 'active' },
  { id: 'zone-2', name: 'appar.se', status: 'active' },
  { id: 'zone-3', name: 'internal.lan', status: 'pending' }
]

const mockRecords: Record<string, DnsRecord[]> = {
  'zone-1': [
    { id: 'rec-1', type: 'A', name: 'example.com', content: '192.0.2.10', ttl: 300, proxied: true },
    { id: 'rec-2', type: 'CNAME', name: 'www', content: 'example.com', ttl: 300 }
  ],
  'zone-2': [
    { id: 'rec-3', type: 'A', name: 'appar.se', content: '198.51.100.5', ttl: 120 },
    { id: 'rec-4', type: 'TXT', name: '_spf', content: '"v=spf1 include:mailgun.org -all"', ttl: 3600 }
  ],
  'zone-3': []
}

export const useDnsStore = defineStore('dns', () => {
  const zones = ref<DnsZone[]>([])
  const records = ref<DnsRecord[]>([])
  const selectedZoneId = ref<string | null>(null)
  const loading = ref(false)

  async function bootstrap() {
    if (!zones.value.length) {
      await refreshZones()
    }
  }

  async function refreshZones() {
    loading.value = true
    const api = useApiClient()
    try {
      zones.value = await api<DnsZone[]>('/dns/zones')
    } catch (error) {
      console.warn('Using mock zones', error)
      zones.value = mockZones
    } finally {
      loading.value = false
    }

    if (!selectedZoneId.value && zones.value.length) {
      selectedZoneId.value = zones.value[0].id
    }

    if (selectedZoneId.value) {
      await fetchRecords(selectedZoneId.value)
    }
  }

  async function fetchRecords(zoneId: string) {
    loading.value = true
    const api = useApiClient()
    try {
      records.value = await api<DnsRecord[]>(`/dns/zones/${zoneId}/records`)
    } catch (error) {
      console.warn('Using mock records', error)
      records.value = mockRecords[zoneId] ?? []
    } finally {
      loading.value = false
    }
  }

  function selectZone(zoneId: string) {
    selectedZoneId.value = zoneId
    fetchRecords(zoneId)
  }

  async function createRecord(payload: CreateDnsRecordPayload) {
    if (!selectedZoneId.value) return
    const api = useApiClient()
    try {
      const created = await api<DnsRecord>(`/dns/zones/${selectedZoneId.value}/records`, {
        method: 'POST',
        body: payload
      })
      records.value = [...records.value, created]
    } catch (error) {
      console.warn('Mock create record', error)
      const record: DnsRecord = {
        id: crypto.randomUUID(),
        ...payload
      }
      records.value = [...records.value, record]
    }
  }

  return {
    zones,
    records,
    selectedZoneId,
    loading,
    bootstrap,
    refreshZones,
    selectZone,
    createRecord
  }
})

