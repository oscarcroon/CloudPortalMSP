import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ContainerInstance, ContainerProject } from '~/types/containers'

const mockProjects: ContainerProject[] = [
  { id: 'proj-1', name: 'Customer Edge' },
  { id: 'proj-2', name: 'Internal Apps' }
]

const mockContainers: ContainerInstance[] = [
  {
    id: 'ct-1',
    name: 'dns-forwarder-01',
    status: 'RUNNING',
    image: 'ubuntu:24.04',
    cpu: '2',
    memory: '4GB',
    projectId: 'proj-1'
  },
  {
    id: 'ct-2',
    name: 'wp-cache',
    status: 'STOPPED',
    image: 'nginx:1.25',
    cpu: '1',
    memory: '2GB',
    projectId: 'proj-1'
  },
  {
    id: 'ct-3',
    name: 'monitoring-node',
    status: 'RUNNING',
    image: 'alpine:3.19',
    cpu: '1',
    memory: '1GB',
    projectId: 'proj-2'
  }
]

export const useContainerStore = defineStore('containers', () => {
  const projects = ref<ContainerProject[]>([])
  const containers = ref<ContainerInstance[]>([])
  const selectedProjectId = ref<string | null>(null)

  async function bootstrap() {
    if (!projects.value.length) {
      await fetchProjects()
    }
    if (!containers.value.length) {
      await fetchContainers()
    }
  }

  async function fetchProjects() {
    const api = useApiClient()
    try {
      projects.value = await api<ContainerProject[]>('/containers/projects')
    } catch (error) {
      console.warn('Using mock container projects', error)
      projects.value = mockProjects
    }

    if (!selectedProjectId.value && projects.value.length) {
      selectedProjectId.value = projects.value[0].id
    }
  }

  async function fetchContainers() {
    const api = useApiClient()
    try {
      containers.value = await api<ContainerInstance[]>('/containers')
    } catch (error) {
      console.warn('Using mock containers', error)
      containers.value = mockContainers
    }
  }

  function requestAction(id: string, action: 'start' | 'stop' | 'restart') {
    console.log(`Would ${action} container ${id}`)
  }

  const filteredContainers = computed(() =>
    containers.value.filter((container) => {
      if (!selectedProjectId.value) return true
      return container.projectId === selectedProjectId.value
    })
  )

  return {
    projects,
    containers,
    filteredContainers,
    selectedProjectId,
    bootstrap,
    requestAction
  }
})

