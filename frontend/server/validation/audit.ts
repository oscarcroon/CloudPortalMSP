import { z } from 'zod'

export const auditContextScopeSchema = z.enum([
  'all',
  'tenant',
  'providers',
  'organizations'
])

export type AuditContextScope = z.infer<typeof auditContextScopeSchema>

export const DEFAULT_AUDIT_CONTEXT_SCOPE: AuditContextScope = 'all'














