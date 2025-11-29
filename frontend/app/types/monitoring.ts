export interface MonitoringAlert {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  status: 'open' | 'acknowledged' | 'resolved'
  source: string
  createdAt: string
  resolvedAt?: string
  organizationId: string
}


