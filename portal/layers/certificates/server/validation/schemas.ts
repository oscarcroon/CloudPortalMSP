/**
 * Certificates Layer Zod Validation Schemas
 */

import { z } from 'zod'

// ---- Shared ----

const domainPattern = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

export const domainSchema = z.string().min(1).max(255).regex(domainPattern, 'Invalid domain format')

export const providerSchema = z.enum(['digicert', 'letsencrypt', 'zerossl', 'custom'])

export const validationMethodSchema = z.enum(['http-01', 'dns-01'])

export const installationTargetSchema = z.enum(['iis', 'pfx', 'centralssl', 'manual'])

export const orderStatusSchema = z.enum([
  'pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'
])

export const runStatusSchema = z.enum([
  'pending', 'running', 'completed', 'failed', 'cancelled'
])

export const certStatusSchema = z.enum([
  'active', 'expiring', 'expired', 'revoked', 'replaced'
])

export const agentStatusSchema = z.enum(['active', 'inactive'])

// ---- Credential Sets ----

export const createCredentialSetSchema = z.object({
  name: z.string().min(1).max(255),
  provider: providerSchema,
  acmeDirectoryUrl: z.string().url().max(1024),
  defaultValidationMethod: validationMethodSchema.optional(),
  eabKid: z.string().max(512).optional(),
  eabHmac: z.string().max(2048).optional(), // Plain text — will be encrypted
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional()
})

export const updateCredentialSetSchema = createCredentialSetSchema.partial()

// ---- Agents ----

export const registerAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  capabilities: z.object({
    supports: z.array(z.string()).default([]),
    dnsProviders: z.array(z.string()).default([])
  }).optional()
})

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1024).optional().nullable(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  capabilities: z.object({
    supports: z.array(z.string()).default([]),
    dnsProviders: z.array(z.string()).default([])
  }).optional(),
  status: agentStatusSchema.optional()
})

// ---- Orders ----

export const createOrderSchema = z.object({
  credentialSetId: z.string().min(1),
  agentId: z.string().min(1),
  primaryDomain: domainSchema,
  subjectAlternativeNames: z.array(domainSchema).max(99).optional().default([]),
  validationMethod: validationMethodSchema,
  validationMeta: z.record(z.unknown()).optional(),
  installationTarget: installationTargetSchema,
  installationMeta: z.record(z.unknown()).optional(),
  autoRenew: z.boolean().optional().default(true),
  renewDaysBefore: z.number().int().min(1).max(90).optional().default(30),
  idempotencyKey: z.string().max(255).optional()
})

// ---- Agent API ----

export const agentHeartbeatSchema = z.object({
  simpleAcmeVersion: z.string().max(100).optional(),
  renewalTaskStatus: z.string().max(100).optional(),
  renewalCount: z.number().int().optional(),
  os: z.string().max(255).optional(),
  hostname: z.string().max(255).optional()
})

export const agentRunStatusSchema = z.object({
  status: z.enum(['running', 'completed', 'failed']),
  logs: z.string().max(262144).optional(), // ~256KB
  sequence: z.number().int().optional(), // For idempotent log dedup
  errorMessage: z.string().max(4096).optional(),
  errorCode: z.string().max(100).optional(),
  resultMeta: z.object({
    serial: z.string().optional(),
    thumbprint: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
    renewalId: z.string().optional(),
    issuer: z.string().optional(),
    providerOrderId: z.string().optional(),
    acmeAccountThumbprint: z.string().optional()
  }).optional()
})

// ---- DNS Challenge (agent-api) ----

export const dnsChallengeSchema = z.object({
  action: z.enum(['create', 'delete']),
  recordName: z.string().min(1),
  challengeValue: z.string().min(1)
})

// ---- Query params ----

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  status: z.string().optional(),
  search: z.string().optional()
})
