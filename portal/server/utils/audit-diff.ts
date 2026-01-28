/**
 * Audit Diff Utilities
 *
 * Provides helpers for building structured change tracking in audit logs.
 * Uses a registry pattern so layers can register their own entity types and fields.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single field change with before and after values.
 */
export interface FieldChange<T = unknown> {
  from: T | null
  to: T | null
}

/**
 * A map of field names to their changes.
 */
export type ChangesMap = Partial<Record<string, FieldChange>>

/**
 * Field type hints for normalization.
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'json'

/**
 * Field definition for audit tracking.
 */
export interface AuditFieldDefinition {
  /** Field name in the entity */
  name: string
  /** Type hint for normalization */
  type?: FieldType
  /** Optional custom normalizer function */
  normalizer?: (value: unknown) => unknown
}

/**
 * Entity type definition for audit diff tracking.
 */
export interface AuditEntityDefinition {
  /** Unique entity type key, e.g. 'windows_dns_record' */
  entityType: string
  /** Module key this entity belongs to, e.g. 'windows-dns' */
  moduleKey: string
  /** Fields to track for this entity type */
  fields: AuditFieldDefinition[]
}

/**
 * Options for building changes.
 */
export interface BuildChangesOptions {
  /** Maximum number of fields to include in changes */
  maxFields?: number
  /** Maximum string length for values (will be truncated) */
  maxValueLength?: number
  /** Entity type for field lookup (uses registered fields) */
  entityType?: string
  /** Custom fields to use instead of registered fields */
  customFields?: readonly string[]
}

/**
 * Result from buildChanges including truncation info.
 */
export interface BuildChangesResult {
  changes: ChangesMap
  truncated: boolean
}

// ============================================================================
// Registry
// ============================================================================

/** Internal registry storage */
const entityRegistry = new Map<string, AuditEntityDefinition>()

/**
 * Register an entity type for audit diff tracking.
 * Called by layers at server init to contribute their entity types.
 *
 * @example
 * registerAuditEntityFields({
 *   entityType: 'windows_dns_record',
 *   moduleKey: 'windows-dns',
 *   fields: [
 *     { name: 'type', type: 'string' },
 *     { name: 'name', type: 'string' },
 *     { name: 'content', type: 'string' },
 *     { name: 'ttl', type: 'number' },
 *     { name: 'priority', type: 'number' },
 *     { name: 'comment', type: 'string' }
 *   ]
 * })
 */
export function registerAuditEntityFields(definition: AuditEntityDefinition): void {
  if (entityRegistry.has(definition.entityType)) {
    console.warn(`[audit-diff] Entity "${definition.entityType}" already registered, overwriting.`)
  }
  entityRegistry.set(definition.entityType, definition)
  console.log(
    `[audit-diff] Registered entity "${definition.entityType}" (${definition.moduleKey}) with ${definition.fields.length} fields`
  )
}

/**
 * Get a registered entity definition.
 */
export function getAuditEntityDefinition(entityType: string): AuditEntityDefinition | undefined {
  return entityRegistry.get(entityType)
}

/**
 * Get all registered entity definitions.
 */
export function getAllAuditEntityDefinitions(): AuditEntityDefinition[] {
  return Array.from(entityRegistry.values())
}

/**
 * Get field names for an entity type.
 * Returns empty array if entity type is not registered.
 */
export function getAuditFieldsForEntity(entityType: string): string[] {
  const definition = entityRegistry.get(entityType)
  return definition?.fields.map((f) => f.name) ?? []
}

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize a string value for comparison.
 * Trims whitespace and handles null/undefined.
 */
const normalizeString = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  return String(value).trim()
}

/**
 * Normalize a number value for comparison.
 * Handles string numbers and null/undefined.
 */
const normalizeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = typeof value === 'number' ? value : Number(value)
  return isNaN(num) ? null : num
}

/**
 * Normalize a boolean value for comparison.
 */
const normalizeBoolean = (value: unknown): boolean | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }
  return Boolean(value)
}

/**
 * Get normalizer function for a field type.
 */
const getNormalizerForType = (type: FieldType | undefined): ((value: unknown) => unknown) => {
  switch (type) {
    case 'string':
      return normalizeString
    case 'number':
      return normalizeNumber
    case 'boolean':
      return normalizeBoolean
    case 'json':
      return (value) => (value === null || value === undefined ? null : value)
    default:
      return (value) => (value === null || value === undefined ? null : value)
  }
}

/**
 * Normalize a field value based on field definition.
 */
const normalizeFieldValue = (
  fieldName: string,
  value: unknown,
  definition?: AuditEntityDefinition
): unknown => {
  // Find field definition
  const fieldDef = definition?.fields.find((f) => f.name === fieldName)

  // Use custom normalizer if provided
  if (fieldDef?.normalizer) {
    return fieldDef.normalizer(value)
  }

  // Use type-based normalizer
  const normalizer = getNormalizerForType(fieldDef?.type)
  return normalizer(value)
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Pick and normalize fields from an entity based on entity type.
 *
 * @param record - The record object to extract fields from
 * @param entityType - Entity type to look up registered fields
 * @param customFields - Optional custom list of fields (overrides registry)
 * @returns Normalized record with only whitelisted fields
 */
export function pickRecordFields(
  record: Record<string, unknown> | null | undefined,
  entityType?: string,
  customFields?: readonly string[]
): Record<string, unknown> | null {
  if (!record) {
    return null
  }

  // Determine which fields to use
  let fields: readonly string[]
  if (customFields && customFields.length > 0) {
    fields = customFields
  } else if (entityType) {
    fields = getAuditFieldsForEntity(entityType)
    if (fields.length === 0) {
      // Fallback: use all keys from record if no fields registered
      console.warn(`[audit-diff] No fields registered for entity "${entityType}", using all record keys`)
      fields = Object.keys(record)
    }
  } else {
    // No entity type or custom fields - use all keys
    fields = Object.keys(record)
  }

  const definition = entityType ? getAuditEntityDefinition(entityType) : undefined
  const result: Record<string, unknown> = {}

  for (const field of fields) {
    const value = record[field]
    result[field] = normalizeFieldValue(field, value, definition)
  }

  return result
}

/**
 * Truncate a string value if it exceeds maxLength.
 */
const truncateValue = (
  value: unknown,
  maxLength: number
): { value: unknown; truncated: boolean } => {
  if (typeof value === 'string' && value.length > maxLength) {
    return {
      value: value.slice(0, maxLength) + '...',
      truncated: true
    }
  }
  return { value, truncated: false }
}

/**
 * Check if two values are equal after normalization.
 */
const valuesAreEqual = (a: unknown, b: unknown): boolean => {
  // Handle null/undefined
  if (a === null || a === undefined) {
    return b === null || b === undefined
  }
  if (b === null || b === undefined) {
    return false
  }

  // Direct comparison for primitives
  if (typeof a !== 'object' && typeof b !== 'object') {
    return a === b
  }

  // For objects, use JSON comparison (handles arrays too)
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Build a changes map from before and after record states.
 *
 * @param before - The record state before the change (null for create)
 * @param after - The record state after the change (null for delete)
 * @param options - Options for truncation, limits, and field selection
 * @returns Object containing changes map and truncation flag
 *
 * @example
 * // For an update operation with entity type
 * const { changes, truncated } = buildChanges(
 *   { type: 'TXT', content: 'old value', ttl: 3600 },
 *   { type: 'TXT', content: 'new value', ttl: 300 },
 *   { entityType: 'windows_dns_record' }
 * )
 * // Result: { content: { from: 'old value', to: 'new value' }, ttl: { from: 3600, to: 300 } }
 */
export function buildChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  options: BuildChangesOptions = {}
): BuildChangesResult {
  const { maxFields = 20, maxValueLength = 2000, entityType, customFields } = options

  // Normalize both records
  const normalizedBefore = pickRecordFields(before, entityType, customFields)
  const normalizedAfter = pickRecordFields(after, entityType, customFields)

  // If both are null, no changes
  if (!normalizedBefore && !normalizedAfter) {
    return { changes: {}, truncated: false }
  }

  const changes: ChangesMap = {}
  let truncated = false
  let fieldCount = 0

  // Get all unique field names from both records
  const allFields = new Set([
    ...Object.keys(normalizedBefore || {}),
    ...Object.keys(normalizedAfter || {})
  ])

  for (const field of allFields) {
    // Check field limit
    if (fieldCount >= maxFields) {
      truncated = true
      break
    }

    const beforeValue = normalizedBefore?.[field] ?? null
    const afterValue = normalizedAfter?.[field] ?? null

    // Skip if values are equal
    if (valuesAreEqual(beforeValue, afterValue)) {
      continue
    }

    // Truncate values if needed
    const { value: truncatedBefore, truncated: beforeTruncated } = truncateValue(
      beforeValue,
      maxValueLength
    )
    const { value: truncatedAfter, truncated: afterTruncated } = truncateValue(
      afterValue,
      maxValueLength
    )

    if (beforeTruncated || afterTruncated) {
      truncated = true
    }

    changes[field] = {
      from: truncatedBefore as unknown,
      to: truncatedAfter as unknown
    }

    fieldCount++
  }

  return { changes, truncated }
}

/**
 * Check if changes map is empty (no actual changes).
 */
export function hasChanges(changes: ChangesMap): boolean {
  return Object.keys(changes).length > 0
}

/**
 * Generate a human-readable summary for audit display.
 *
 * @param recordType - DNS record type (e.g., 'A', 'TXT', 'MX')
 * @param recordName - DNS record name (e.g., '@', 'www', '_dmarc')
 * @returns Summary string like "TXT _dmarc" or "A @"
 */
export function generateAuditSummary(
  recordType: string | null | undefined,
  recordName: string | null | undefined
): string {
  const type = recordType || 'UNKNOWN'
  const name = recordName || '@'
  return `${type} ${name}`
}

/**
 * Build complete audit metadata for entity operations.
 *
 * @param params - Parameters for building audit metadata
 * @returns Complete metadata object ready for logAuditEvent
 */
export function buildAuditMeta(params: {
  moduleKey: string
  entityType: string
  entityId: string | null
  operation: 'create' | 'update' | 'delete'
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  /** Additional metadata fields to include */
  extra?: Record<string, unknown>
  /** Optional summary generator function */
  summaryFn?: (before: Record<string, unknown> | null, after: Record<string, unknown> | null) => string
}): Record<string, unknown> {
  const { moduleKey, entityType, entityId, operation, before, after, extra, summaryFn } = params

  // Build changes using entity type for field lookup
  const { changes, truncated } = buildChanges(before, after, { entityType })

  // Build base metadata
  const meta: Record<string, unknown> = {
    moduleKey,
    entityType,
    entityId,
    operation,
    ...extra
  }

  // Add summary if generator provided
  if (summaryFn) {
    meta.summary = summaryFn(before ?? null, after ?? null)
  }

  // Add changes if there are any
  if (hasChanges(changes)) {
    meta.changes = changes
  }

  // Add truncation flag if needed
  if (truncated) {
    meta.truncated = true
  }

  return meta
}

/**
 * Build complete audit metadata for DNS record operations.
 * Convenience wrapper for DNS-specific audit logging.
 *
 * @param params - Parameters for building audit metadata
 * @returns Complete metadata object ready for logAuditEvent
 */
export function buildDnsRecordAuditMeta(params: {
  moduleKey: string
  entityType: string
  entityId: string | null
  zoneId: string
  zoneName?: string
  recordType?: string | null
  recordName?: string | null
  operation: 'create' | 'update' | 'delete'
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
}): Record<string, unknown> {
  const {
    moduleKey,
    entityType,
    entityId,
    zoneId,
    zoneName,
    recordType,
    recordName,
    operation,
    before,
    after
  } = params

  return buildAuditMeta({
    moduleKey,
    entityType,
    entityId,
    operation,
    before,
    after,
    extra: {
      zoneId,
      zoneName,
      recordType,
      recordName
    },
    summaryFn: () => generateAuditSummary(recordType, recordName)
  })
}
