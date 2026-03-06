/**
 * Cloudflare DNS Audit Module
 *
 * Registers audit event types and entity fields for the Cloudflare DNS layer.
 */

import { registerAuditModule } from '~~/server/audit/registry'
import { registerAuditEntityFields } from '~~/server/utils/audit-diff'
import type { AuditEventType } from '~~/server/utils/audit'

const eventTypes: AuditEventType[] = [
  'CLOUDFLARE_DNS_RECORD_CREATED',
  'CLOUDFLARE_DNS_RECORD_UPDATED',
  'CLOUDFLARE_DNS_RECORD_DELETED',
  'CLOUDFLARE_DNS_ZONE_CREATED',
  'CLOUDFLARE_DNS_ZONE_DELETED',
  'CLOUDFLARE_DNS_ZONE_IMPORTED',
  'CLOUDFLARE_DNS_CONFIG_UPDATED',
  'CLOUDFLARE_DNS_CONFIG_DELETED'
]

// Register audit event types
registerAuditModule({
  moduleKey: 'cloudflare-dns',
  moduleName: {
    sv: 'Cloudflare DNS',
    en: 'Cloudflare DNS'
  },
  eventTypes,
  eventLabels: {
    CLOUDFLARE_DNS_RECORD_CREATED: {
      sv: 'DNS-post skapad',
      en: 'DNS record created'
    },
    CLOUDFLARE_DNS_RECORD_UPDATED: {
      sv: 'DNS-post uppdaterad',
      en: 'DNS record updated'
    },
    CLOUDFLARE_DNS_RECORD_DELETED: {
      sv: 'DNS-post borttagen',
      en: 'DNS record deleted'
    },
    CLOUDFLARE_DNS_ZONE_CREATED: {
      sv: 'DNS-zon skapad',
      en: 'DNS zone created'
    },
    CLOUDFLARE_DNS_ZONE_DELETED: {
      sv: 'DNS-zon borttagen',
      en: 'DNS zone deleted'
    },
    CLOUDFLARE_DNS_ZONE_IMPORTED: {
      sv: 'DNS-zon importerad',
      en: 'DNS zone imported'
    },
    CLOUDFLARE_DNS_CONFIG_UPDATED: {
      sv: 'Cloudflare-konfiguration uppdaterad',
      en: 'Cloudflare configuration updated'
    },
    CLOUDFLARE_DNS_CONFIG_DELETED: {
      sv: 'Cloudflare-konfiguration borttagen',
      en: 'Cloudflare configuration deleted'
    }
  },
  // All events are visible in org audit
  orgAuditEventTypes: eventTypes
})

// Register entity fields for audit diff tracking
registerAuditEntityFields({
  entityType: 'cloudflare_dns_record',
  moduleKey: 'cloudflare-dns',
  fields: [
    { name: 'type', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'content', type: 'string' },
    { name: 'ttl', type: 'number' },
    { name: 'priority', type: 'number' },
    { name: 'proxied', type: 'boolean' },
    { name: 'comment', type: 'string' }
  ]
})
