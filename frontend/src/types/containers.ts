export interface ContainerProject {
  id: string
  name: string
}

export interface ContainerInstance {
  id: string
  name: string
  status: 'RUNNING' | 'STOPPED'
  image: string
  cpu: string
  memory: string
  projectId: string
}

