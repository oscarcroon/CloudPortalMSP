export interface VmInstance {
  id: string
  name: string
  powerState: 'poweredOn' | 'poweredOff'
  cpu: string
  memory: string
  disk: string
  platform: 'ESXi' | 'Morpheus'
  organisationId: string
}

