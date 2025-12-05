export interface DnsZone {
  id: string
  name: string
  status: 'active' | 'pending' | 'error'
}

export interface DnsRecord {
  id: string
  type: string
  name: string
  content: string
  ttl: number
  proxied?: boolean
}

export interface CreateDnsRecordPayload {
  type: string
  name: string
  content: string
  ttl: number
  proxied: boolean
}

