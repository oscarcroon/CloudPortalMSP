import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { WordpressSite } from '~/types/wordpress'

const mockSites: WordpressSite[] = [
  {
    id: 'wp-1',
    name: 'Marketing',
    domain: 'marketing.example.com',
    status: 'healthy',
    version: '6.6.2',
    lastBackup: 'Idag 06:15',
    region: 'Karlstad',
    organisationId: 'org-coreit'
  },
  {
    id: 'wp-2',
    name: 'Docs',
    domain: 'docs.example.com',
    status: 'warning',
    version: '6.5.3',
    lastBackup: 'Igår 22:00',
    region: 'Karlstad',
    organisationId: 'org-internal'
  }
]

export const useWordpressStore = defineStore('wordpress', () => {
  const sites = ref<WordpressSite[]>([])

  async function bootstrap() {
    if (!sites.value.length) {
      await fetchSites()
    }
  }

  async function fetchSites() {
    const api = useApiClient()
    try {
      sites.value = await api<WordpressSite[]>('/wordpress/sites')
    } catch (error) {
      console.warn('Using mock WordPress sites', error)
      sites.value = mockSites
    }
  }

  async function trigger(id: string, action: 'deploy' | 'backup' | 'update') {
    const api = useApiClient()
    try {
      await api(`/wordpress/sites/${id}/actions/${action}`, { method: 'POST' })
    } catch (error) {
      console.warn(`Mock ${action} for site ${id}`, error)
    }
  }

  return {
    sites,
    bootstrap,
    trigger
  }
})

