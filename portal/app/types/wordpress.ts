export interface WordpressSite {
  id: string
  name: string
  domain: string
  status: 'healthy' | 'warning' | 'failed'
  version: string
  lastBackup: string
  region: string
  organizationId: string
}

