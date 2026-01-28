/**
 * Windows DNS Redirects Audit Module
 *
 * Registers audit event types for the Windows DNS Redirects layer.
 */

import { registerAuditModule } from '~~/server/audit/registry'
import type { AuditEventType } from '~~/server/utils/audit'

const eventTypes: AuditEventType[] = [
  'WINDOWS_DNS_REDIRECT_CREATED',
  'WINDOWS_DNS_REDIRECT_UPDATED',
  'WINDOWS_DNS_REDIRECT_DELETED',
  'WINDOWS_DNS_REDIRECTS_IMPORTED',
  'WINDOWS_DNS_REDIRECTS_BULK_DELETED',
  'WINDOWS_DNS_REDIRECTS_BULK_TOGGLED',
  'WINDOWS_DNS_REDIRECTS_TRAEFIK_SYNC'
]

registerAuditModule({
  moduleKey: 'windows-dns-redirects',
  moduleName: {
    sv: 'Windows DNS Redirects',
    en: 'Windows DNS Redirects'
  },
  eventTypes,
  eventLabels: {
    WINDOWS_DNS_REDIRECT_CREATED: {
      sv: 'Redirect skapad',
      en: 'Redirect created'
    },
    WINDOWS_DNS_REDIRECT_UPDATED: {
      sv: 'Redirect uppdaterad',
      en: 'Redirect updated'
    },
    WINDOWS_DNS_REDIRECT_DELETED: {
      sv: 'Redirect borttagen',
      en: 'Redirect deleted'
    },
    WINDOWS_DNS_REDIRECTS_IMPORTED: {
      sv: 'Redirects importerade',
      en: 'Redirects imported'
    },
    WINDOWS_DNS_REDIRECTS_BULK_DELETED: {
      sv: 'Redirects mass-borttagna',
      en: 'Redirects bulk deleted'
    },
    WINDOWS_DNS_REDIRECTS_BULK_TOGGLED: {
      sv: 'Redirects mass-växlade',
      en: 'Redirects bulk toggled'
    },
    WINDOWS_DNS_REDIRECTS_TRAEFIK_SYNC: {
      sv: 'Traefik-synk utförd',
      en: 'Traefik sync performed'
    }
  },
  // All events are visible in org audit
  orgAuditEventTypes: eventTypes
})
