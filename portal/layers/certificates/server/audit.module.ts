/**
 * Certificates Audit Module
 *
 * Registers audit event types and entity fields for the Certificates layer.
 */

import { registerAuditModule } from '~~/server/audit/registry'
import { registerAuditEntityFields } from '~~/server/utils/audit-diff'
import type { AuditEventType } from '~~/server/utils/audit'

const eventTypes: AuditEventType[] = [
  'CERT_CREDENTIAL_SET_CREATED',
  'CERT_CREDENTIAL_SET_UPDATED',
  'CERT_CREDENTIAL_SET_DELETED',
  'CERT_CREDENTIAL_SET_ROTATED',
  'CERT_AGENT_REGISTERED',
  'CERT_AGENT_UPDATED',
  'CERT_AGENT_DEACTIVATED',
  'CERT_ORDER_CREATED',
  'CERT_ORDER_CANCELLED',
  'CERT_ORDER_DOMAIN_REJECTED',
  'CERT_RUN_STARTED',
  'CERT_RUN_COMPLETED',
  'CERT_RUN_FAILED',
  'CERT_RUN_LEASE_EXPIRED',
  'CERT_CERTIFICATE_ISSUED',
  'CERT_CERTIFICATE_RENEWED'
]

registerAuditModule({
  moduleKey: 'certificates',
  moduleName: {
    sv: 'Certifikat',
    en: 'Certificates'
  },
  eventTypes,
  eventLabels: {
    CERT_CREDENTIAL_SET_CREATED: {
      sv: 'ACME-autentiseringsuppgifter skapade',
      en: 'ACME credential set created'
    },
    CERT_CREDENTIAL_SET_UPDATED: {
      sv: 'ACME-autentiseringsuppgifter uppdaterade',
      en: 'ACME credential set updated'
    },
    CERT_CREDENTIAL_SET_DELETED: {
      sv: 'ACME-autentiseringsuppgifter borttagna',
      en: 'ACME credential set deleted'
    },
    CERT_CREDENTIAL_SET_ROTATED: {
      sv: 'ACME-autentiseringsuppgifter roterade',
      en: 'ACME credential set rotated'
    },
    CERT_AGENT_REGISTERED: {
      sv: 'Certifikatagent registrerad',
      en: 'Certificate agent registered'
    },
    CERT_AGENT_UPDATED: {
      sv: 'Certifikatagent uppdaterad',
      en: 'Certificate agent updated'
    },
    CERT_AGENT_DEACTIVATED: {
      sv: 'Certifikatagent inaktiverad',
      en: 'Certificate agent deactivated'
    },
    CERT_ORDER_CREATED: {
      sv: 'Certifikatbeställning skapad',
      en: 'Certificate order created'
    },
    CERT_ORDER_CANCELLED: {
      sv: 'Certifikatbeställning avbruten',
      en: 'Certificate order cancelled'
    },
    CERT_ORDER_DOMAIN_REJECTED: {
      sv: 'Domänvalidering avvisad',
      en: 'Domain validation rejected'
    },
    CERT_RUN_STARTED: {
      sv: 'Certifikatkörning startad',
      en: 'Certificate run started'
    },
    CERT_RUN_COMPLETED: {
      sv: 'Certifikatkörning slutförd',
      en: 'Certificate run completed'
    },
    CERT_RUN_FAILED: {
      sv: 'Certifikatkörning misslyckad',
      en: 'Certificate run failed'
    },
    CERT_RUN_LEASE_EXPIRED: {
      sv: 'Certifikatkörning lease utgången',
      en: 'Certificate run lease expired'
    },
    CERT_CERTIFICATE_ISSUED: {
      sv: 'Certifikat utfärdat',
      en: 'Certificate issued'
    },
    CERT_CERTIFICATE_RENEWED: {
      sv: 'Certifikat förnyat',
      en: 'Certificate renewed'
    }
  },
  orgAuditEventTypes: eventTypes
})

registerAuditEntityFields({
  entityType: 'cert_credential_set',
  moduleKey: 'certificates',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'provider', type: 'string' },
    { name: 'acmeDirectoryUrl', type: 'string' },
    { name: 'isDefault', type: 'boolean' },
    { name: 'isActive', type: 'boolean' }
  ]
})

registerAuditEntityFields({
  entityType: 'cert_agent',
  moduleKey: 'certificates',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'capabilities', type: 'string' }
  ]
})

registerAuditEntityFields({
  entityType: 'cert_order',
  moduleKey: 'certificates',
  fields: [
    { name: 'primaryDomain', type: 'string' },
    { name: 'validationMethod', type: 'string' },
    { name: 'installationTarget', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'autoRenew', type: 'boolean' }
  ]
})
