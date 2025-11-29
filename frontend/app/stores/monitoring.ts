import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { MonitoringAlert } from '~/types/monitoring'

const mockAlerts: MonitoringAlert[] = [
  {
    id: 'alert-1',
    title: 'Disk usage över 90%',
    description: 'edge-core-01 rapporterar diskavvikelse på /var',
    severity: 'critical',
    status: 'open',
    source: 'Prometheus',
    createdAt: '2025-11-22T05:15:00Z',
    organizationId: 'org-coreit'
  },
  {
    id: 'alert-2',
    title: 'Backup misslyckades',
    description: 'Veeam-jobbet nightly-apps har misslyckats två gånger',
    severity: 'warning',
    status: 'acknowledged',
    source: 'Veeam',
    createdAt: '2025-11-21T22:40:00Z',
    organizationId: 'org-coreit'
  },
  {
    id: 'alert-3',
    title: 'Agent offline',
    description: 'fileserver-legacy svarar inte på heartbeat',
    severity: 'warning',
    status: 'open',
    source: 'nCentral',
    createdAt: '2025-11-22T03:05:00Z',
    organizationId: 'org-internal'
  },
  {
    id: 'alert-4',
    title: 'Certificate expiring',
    description: 'api.internal.example.com löper ut om 10 dagar',
    severity: 'info',
    status: 'resolved',
    source: 'Let\'s Encrypt',
    createdAt: '2025-11-18T09:30:00Z',
    resolvedAt: '2025-11-19T08:00:00Z',
    organizationId: 'org-internal'
  }
]

const severityWeight = {
  critical: 0,
  warning: 1,
  info: 2
} as const

export const useMonitoringStore = defineStore('monitoring', () => {
  const alerts = ref<MonitoringAlert[]>([])
  const isLoading = ref(false)

  async function bootstrap() {
    if (!alerts.value.length) {
      await fetchAlerts()
    }
  }

  async function fetchAlerts() {
    const api = useApiClient()
    isLoading.value = true
    try {
      alerts.value = await api<MonitoringAlert[]>('/monitoring/alerts')
    } catch (error) {
      console.warn('Using mock monitoring alerts', error)
      alerts.value = mockAlerts
    } finally {
      isLoading.value = false
    }
  }

  async function acknowledgeAlert(alertId: string) {
    const api = useApiClient()
    try {
      await api(`/monitoring/alerts/${alertId}/acknowledge`, { method: 'POST' })
      alerts.value = alerts.value.map((alert) =>
        alert.id === alertId ? { ...alert, status: 'acknowledged' } : alert
      )
    } catch (error) {
      console.warn(`Mock acknowledge alert ${alertId}`, error)
      alerts.value = alerts.value.map((alert) =>
        alert.id === alertId ? { ...alert, status: 'acknowledged' } : alert
      )
    }
  }

  const sortedAlerts = computed(() =>
    [...alerts.value].sort((a, b) => {
      const severityComparison = severityWeight[a.severity] - severityWeight[b.severity]
      if (severityComparison !== 0) return severityComparison
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  )

  const openAlerts = computed(() => alerts.value.filter((alert) => alert.status !== 'resolved'))

  return {
    alerts,
    sortedAlerts,
    openAlerts,
    isLoading,
    bootstrap,
    fetchAlerts,
    acknowledgeAlert
  }
})


