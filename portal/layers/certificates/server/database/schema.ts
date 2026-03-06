/**
 * Certificates Layer Database Schema
 *
 * All tables prefixed with 'cert_' to avoid conflicts.
 * Factory function receives the organizations ID column for FK references.
 */

import { createId } from '@paralleldrive/cuid2'
import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core'

const timestampColumns = () => ({
  createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).notNull().defaultNow().onUpdateNow()
})

export function createCertificatesSchema(organizationsIdColumn: AnyMySqlColumn) {
  // -------------------------------------------------------------------------
  // cert_agents — registered external agents that execute ACME operations
  // -------------------------------------------------------------------------
  const certAgents = mysqlTable(
    'cert_agents',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      name: varchar('name', { length: 255 }).notNull(),
      description: text('description'),
      tokenPrefix: varchar('token_prefix', { length: 255 }).notNull(),
      tokenHash: varchar('token_hash', { length: 255 }).notNull(),
      tokenSalt: varchar('token_salt', { length: 255 }).notNull(),
      tokenHashAlg: varchar('token_hash_alg', { length: 50 }).notNull().default('scrypt-v1'),
      tokenPepperKid: varchar('token_pepper_kid', { length: 255 }).notNull(),
      tags: text('tags'), // JSON array
      capabilities: text('capabilities'), // JSON: { supports: string[], dnsProviders: string[] }
      status: varchar('status', { length: 50 })
        .$type<'active' | 'inactive'>()
        .notNull()
        .default('active'),
      lastHeartbeatAt: timestamp('last_heartbeat_at', { fsp: 3 }),
      lastSeenIp: varchar('last_seen_ip', { length: 50 }),
      heartbeatMeta: text('heartbeat_meta'), // JSON: simpleAcmeVersion, renewalTaskStatus, etc.
      createdByUserId: varchar('created_by_user_id', { length: 128 }),
      ...timestampColumns()
    },
    (table) => ({
      orgIdx: index('cert_agents_org_idx').on(table.organizationId),
      prefixUnique: uniqueIndex('cert_agents_prefix_unique').on(table.tokenPrefix),
      orgStatusIdx: index('cert_agents_org_status_idx').on(table.organizationId, table.status)
    })
  )

  // -------------------------------------------------------------------------
  // cert_credential_sets — ACME provider credentials (EAB, directory URL)
  // -------------------------------------------------------------------------
  const certCredentialSets = mysqlTable(
    'cert_credential_sets',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      name: varchar('name', { length: 255 }).notNull(),
      provider: varchar('provider', { length: 50 })
        .$type<'digicert' | 'letsencrypt' | 'zerossl' | 'custom'>()
        .notNull(),
      acmeDirectoryUrl: varchar('acme_directory_url', { length: 1024 }).notNull(),
      defaultValidationMethod: varchar('default_validation_method', { length: 20 }),
      eabKid: varchar('eab_kid', { length: 512 }),
      encryptedEabHmac: text('encrypted_eab_hmac'),
      eabHmacSecretRef: varchar('eab_hmac_secret_ref', { length: 1024 }),
      encryptionIv: text('encryption_iv'),
      encryptionAuthTag: text('encryption_auth_tag'),
      isDefault: boolean('is_default').notNull().default(false),
      isActive: boolean('is_active').notNull().default(true),
      effectiveFrom: timestamp('effective_from', { fsp: 3 }),
      effectiveTo: timestamp('effective_to', { fsp: 3 }),
      rotatedFromId: varchar('rotated_from_id', { length: 128 }),
      createdByUserId: varchar('created_by_user_id', { length: 128 }),
      ...timestampColumns()
    },
    (table) => ({
      orgIdx: index('cert_credential_sets_org_idx').on(table.organizationId),
      orgNameUnique: uniqueIndex('cert_credential_sets_org_name_unique').on(
        table.organizationId,
        table.name
      ),
      orgDefaultIdx: index('cert_credential_sets_org_default_idx').on(
        table.organizationId,
        table.isDefault
      )
    })
  )

  // -------------------------------------------------------------------------
  // cert_orders — certificate order requests
  // -------------------------------------------------------------------------
  const certOrders = mysqlTable(
    'cert_orders',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      credentialSetId: varchar('credential_set_id', { length: 128 }).notNull(),
      agentId: varchar('agent_id', { length: 128 }).notNull(),
      primaryDomain: varchar('primary_domain', { length: 255 }).notNull(),
      subjectAlternativeNames: text('subject_alternative_names'), // JSON array
      validationMethod: varchar('validation_method', { length: 20 })
        .$type<'http-01' | 'dns-01'>()
        .notNull(),
      validationMeta: text('validation_meta'), // JSON: zoneId, zoneName, dnsProvider
      installationTarget: varchar('installation_target', { length: 50 })
        .$type<'iis' | 'pfx' | 'centralssl' | 'manual'>()
        .notNull(),
      installationMeta: text('installation_meta'), // JSON
      status: varchar('status', { length: 50 })
        .$type<'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'>()
        .notNull()
        .default('pending'),
      idempotencyKey: varchar('idempotency_key', { length: 255 }),
      autoRenew: boolean('auto_renew').notNull().default(true),
      renewalName: varchar('renewal_name', { length: 255 }),
      renewDaysBefore: int('renew_days_before').notNull().default(30),
      createdByUserId: varchar('created_by_user_id', { length: 128 }),
      ...timestampColumns()
    },
    (table) => ({
      orgIdx: index('cert_orders_org_idx').on(table.organizationId),
      orgStatusIdx: index('cert_orders_org_status_idx').on(table.organizationId, table.status),
      idempotencyUnique: uniqueIndex('cert_orders_idempotency_unique').on(
        table.organizationId,
        table.idempotencyKey
      ),
      agentIdx: index('cert_orders_agent_idx').on(table.agentId),
      credentialSetIdx: index('cert_orders_credential_set_idx').on(table.credentialSetId)
    })
  )

  // -------------------------------------------------------------------------
  // cert_order_runs — individual execution attempts for an order
  // -------------------------------------------------------------------------
  const certOrderRuns = mysqlTable(
    'cert_order_runs',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      orderId: varchar('order_id', { length: 128 }).notNull(),
      agentId: varchar('agent_id', { length: 128 }).notNull(),
      runPayload: text('run_payload'), // Immutable JSON snapshot
      status: varchar('status', { length: 50 })
        .$type<'pending' | 'running' | 'completed' | 'failed' | 'cancelled'>()
        .notNull()
        .default('pending'),
      logs: text('logs'),
      logRef: varchar('log_ref', { length: 1024 }),
      startedAt: timestamp('started_at', { fsp: 3 }),
      completedAt: timestamp('completed_at', { fsp: 3 }),
      leasedUntil: timestamp('leased_until', { fsp: 3 }),
      leaseId: varchar('lease_id', { length: 128 }),
      resultMeta: text('result_meta'), // JSON: serial, thumbprint, expiresAt, renewalId
      errorMessage: text('error_message'),
      errorCode: varchar('error_code', { length: 100 }),
      lastLogSequence: int('last_log_sequence'),
      runNumber: int('run_number').notNull().default(1),
      ...timestampColumns()
    },
    (table) => ({
      orderIdx: index('cert_order_runs_order_idx').on(table.orderId),
      agentIdx: index('cert_order_runs_agent_idx').on(table.agentId),
      statusIdx: index('cert_order_runs_status_idx').on(table.status),
      leaseIdx: index('cert_order_runs_lease_idx').on(table.leaseId),
      leasedUntilIdx: index('cert_order_runs_leased_until_idx').on(table.leasedUntil, table.status)
    })
  )

  // -------------------------------------------------------------------------
  // cert_certificates — issued certificate inventory
  // -------------------------------------------------------------------------
  const certCertificates = mysqlTable(
    'cert_certificates',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      orderId: varchar('order_id', { length: 128 }),
      credentialSetId: varchar('credential_set_id', { length: 128 }),
      primaryDomain: varchar('primary_domain', { length: 255 }).notNull(),
      subjectAlternativeNames: text('subject_alternative_names'), // JSON
      issuer: varchar('issuer', { length: 512 }),
      serialNumber: varchar('serial_number', { length: 512 }),
      thumbprint: varchar('thumbprint', { length: 255 }),
      providerOrderId: varchar('provider_order_id', { length: 512 }),
      acmeAccountThumbprint: varchar('acme_account_thumbprint', { length: 255 }),
      renewalName: varchar('renewal_name', { length: 255 }),
      issuedAt: timestamp('issued_at', { fsp: 3 }),
      expiresAt: timestamp('expires_at', { fsp: 3 }),
      installationTarget: varchar('installation_target', { length: 50 }),
      installationMeta: text('installation_meta'), // JSON
      nextRenewalAt: timestamp('next_renewal_at', { fsp: 3 }),
      renewalOrderId: varchar('renewal_order_id', { length: 128 }),
      status: varchar('status', { length: 50 })
        .$type<'active' | 'expiring' | 'expired' | 'revoked' | 'replaced'>()
        .notNull()
        .default('active'),
      ...timestampColumns()
    },
    (table) => ({
      orgIdx: index('cert_certificates_org_idx').on(table.organizationId),
      orgThumbprintUnique: uniqueIndex('cert_certificates_org_thumbprint_unique').on(
        table.organizationId,
        table.thumbprint
      ),
      orgStatusIdx: index('cert_certificates_org_status_idx').on(
        table.organizationId,
        table.status
      ),
      expiresAtIdx: index('cert_certificates_expires_at_idx').on(table.expiresAt),
      domainIdx: index('cert_certificates_domain_idx').on(table.primaryDomain),
      orderIdx: index('cert_certificates_order_idx').on(table.orderId)
    })
  )

  return {
    certAgents,
    certCredentialSets,
    certOrders,
    certOrderRuns,
    certCertificates
  }
}

export type CertificatesSchema = ReturnType<typeof createCertificatesSchema>
