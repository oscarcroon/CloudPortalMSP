/**
 * Windows DNS Audit Module
 *
 * Registers audit event types for the Windows DNS layer.
 */

import { registerAuditModule } from '~~/server/audit/registry'
import type { AuditEventType } from '~~/server/utils/audit'

const eventTypes: AuditEventType[] = [
  'WINDOWS_DNS_RECORD_CREATED',
  'WINDOWS_DNS_RECORD_UPDATED',
  'WINDOWS_DNS_RECORD_DELETED'
]

registerAuditModule({
  moduleKey: 'windows-dns',
  moduleName: {
    sv: 'Windows DNS',
    en: 'Windows DNS'
  },
  eventTypes,
  eventLabels: {
    WINDOWS_DNS_RECORD_CREATED: {
      sv: 'DNS-post skapad',
      en: 'DNS record created'
    },
    WINDOWS_DNS_RECORD_UPDATED: {
      sv: 'DNS-post uppdaterad',
      en: 'DNS record updated'
    },
    WINDOWS_DNS_RECORD_DELETED: {
      sv: 'DNS-post borttagen',
      en: 'DNS record deleted'
    }
  },
  // All events are visible in org audit
  orgAuditEventTypes: eventTypes
})
