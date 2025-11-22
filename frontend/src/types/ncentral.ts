export interface NcentralDevice {
  id: string
  name: string
  status: 'online' | 'warning' | 'offline'
  type: 'server' | 'workstation' | 'appliance'
  osVersion: string
  region: string
  lastSeen: string
  organizationId: string
}


