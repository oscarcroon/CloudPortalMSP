/**
 * Audit Module Registry
 *
 * Provides a plugin-like system for layers to register their audit event types.
 * This allows org-audit endpoints and UI to dynamically include events from
 * all registered modules without hardcoding each event type in core.
 */

import type { AuditEventType } from '../utils/audit'

export interface AuditEventLabel {
  sv: string
  en: string
}

export interface AuditModuleDefinition {
  /** Unique module key, e.g. 'windows-dns' */
  moduleKey: string
  /** Display name for grouping in UI */
  moduleName: {
    sv: string
    en: string
  }
  /** Event types this module contributes */
  eventTypes: AuditEventType[]
  /** Human-readable labels for each event type */
  eventLabels: Partial<Record<AuditEventType, AuditEventLabel>>
  /** 
   * Which events should be visible in org-level audit logs.
   * If not specified, all eventTypes are included.
   */
  orgAuditEventTypes?: AuditEventType[]
}

// Internal registry storage
const auditModules = new Map<string, AuditModuleDefinition>()

/**
 * Register an audit module.
 * Called by layers at server init to contribute their audit events.
 */
export function registerAuditModule(definition: AuditModuleDefinition): void {
  if (auditModules.has(definition.moduleKey)) {
    console.warn(`[audit-registry] Module "${definition.moduleKey}" already registered, overwriting.`)
  }
  auditModules.set(definition.moduleKey, definition)
  console.log(`[audit-registry] Registered module "${definition.moduleKey}" with ${definition.eventTypes.length} event types`)
}

/**
 * Get all registered audit modules.
 */
export function getAuditModules(): AuditModuleDefinition[] {
  return Array.from(auditModules.values())
}

/**
 * Get a specific audit module by key.
 */
export function getAuditModule(moduleKey: string): AuditModuleDefinition | undefined {
  return auditModules.get(moduleKey)
}

/**
 * Get event types for a specific module by key.
 * Returns empty array if module not found.
 * For 'core' module, returns coreAllEventTypes.
 */
export function getEventTypesForModule(moduleKey: string): AuditEventType[] {
  if (moduleKey === 'core') {
    return coreAllEventTypes
  }
  const module = auditModules.get(moduleKey)
  return module?.eventTypes ?? []
}

/**
 * Get all event types that should be visible in org-level audit logs.
 * This aggregates from all registered modules.
 */
export function getOrgAuditEventTypes(): AuditEventType[] {
  const eventTypes: AuditEventType[] = []

  for (const module of auditModules.values()) {
    // Use orgAuditEventTypes if specified, otherwise use all eventTypes
    const moduleEvents = module.orgAuditEventTypes ?? module.eventTypes
    eventTypes.push(...moduleEvents)
  }

  return eventTypes
}

/**
 * Get all event labels for UI display.
 * Returns a merged object from all modules.
 */
export function getAuditEventLabels(): Record<string, AuditEventLabel> {
  const labels: Record<string, AuditEventLabel> = {}

  for (const module of auditModules.values()) {
    for (const [eventType, label] of Object.entries(module.eventLabels)) {
      if (label) {
        labels[eventType] = label
      }
    }
  }

  return labels
}

/**
 * Get event types grouped by module for UI dropdowns.
 */
export function getAuditEventTypesByModule(locale: 'sv' | 'en' = 'sv'): Array<{
  moduleKey: string
  moduleName: string
  eventTypes: Array<{
    type: AuditEventType
    label: string
  }>
}> {
  const result = []

  for (const module of auditModules.values()) {
    const moduleEvents = module.orgAuditEventTypes ?? module.eventTypes
    result.push({
      moduleKey: module.moduleKey,
      moduleName: module.moduleName[locale],
      eventTypes: moduleEvents.map(type => ({
        type,
        label: module.eventLabels[type]?.[locale] ?? type
      }))
    })
  }

  return result
}

// Core event types that are always included in org audit
// These are not from layers but from core functionality
export const coreOrgAuditEventTypes: AuditEventType[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'ROLE_CHANGED',
  'STATUS_CHANGED',
  'USER_INVITED',
  'USER_REMOVED',
  'MODULE_ENABLED',
  'MODULE_DISABLED',
  'SENSITIVE_DATA_ACCESSED',
  'ORGANIZATION_UPDATED',
  'ORG_SETTINGS_UPDATED',
  'ORG_AUTH_SETTINGS_UPDATED'
]

// All core event types (for admin views - includes more than org audit)
export const coreAllEventTypes: AuditEventType[] = [
  // Authentication & Security
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_STEP_UP',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'RATE_LIMIT_EXCEEDED',
  'PERMISSION_DENIED',
  'SENSITIVE_DATA_ACCESSED',
  // User & Roles
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'USER_INVITED',
  'INVITE_ACCEPTED',
  'INVITE_CANCELLED',
  'INVITE_EXPIRED',
  'USER_REMOVED',
  'ROLE_CHANGED',
  'STATUS_CHANGED',
  // Organizations
  'ORGANIZATION_CREATED',
  'ORGANIZATION_UPDATED',
  'ORGANIZATION_DELETED',
  'ORG_SETTINGS_UPDATED',
  'ORG_AUTH_SETTINGS_UPDATED',
  // Tenants / Distributors / Providers
  'TENANT_CREATED',
  'TENANT_UPDATED',
  'TENANT_DELETED',
  'TENANT_SETTINGS_UPDATED',
  'SSO_CONFIGURED',
  'SSO_UPDATED',
  'SSO_REMOVED',
  // Modules & Configuration
  'MODULE_ENABLED',
  'MODULE_DISABLED',
  'EMAIL_PROVIDER_CONFIGURED',
  'EMAIL_PROVIDER_UPDATED',
  'API_TOKEN_CREATED',
  'API_TOKEN_REVOKED',
  'API_TOKEN_USED',
  'API_TOKEN_AUTH_FAILED',
  'API_KEY_ROTATED',
  'API_KEY_CREATED',
  'API_KEY_DELETED',
  // Context & Other
  'CONTEXT_SWITCH',
  'BILLING_UPDATED'
]

export const coreAuditEventLabels: Record<string, AuditEventLabel> = {
  // Authentication & Security
  LOGIN_SUCCESS: { sv: 'Lyckad inloggning', en: 'Successful login' },
  LOGIN_FAILED: { sv: 'Misslyckad inloggning', en: 'Failed login' },
  LOGOUT: { sv: 'Utloggning', en: 'Logout' },
  MFA_ENABLED: { sv: 'MFA aktiverad', en: 'MFA enabled' },
  MFA_DISABLED: { sv: 'MFA inaktiverad', en: 'MFA disabled' },
  MFA_STEP_UP: { sv: 'MFA steg-upp', en: 'MFA step-up' },
  PASSWORD_CHANGED: { sv: 'Lösenord ändrat', en: 'Password changed' },
  PASSWORD_RESET_REQUESTED: { sv: 'Lösenordsåterställning begärd', en: 'Password reset requested' },
  PASSWORD_RESET_COMPLETED: { sv: 'Lösenordsåterställning slutförd', en: 'Password reset completed' },
  RATE_LIMIT_EXCEEDED: { sv: 'Hastighetsgräns överskriden', en: 'Rate limit exceeded' },
  PERMISSION_DENIED: { sv: 'Åtkomst nekad', en: 'Permission denied' },
  SENSITIVE_DATA_ACCESSED: { sv: 'Känslig data åtkomst', en: 'Sensitive data accessed' },
  // User & Roles
  USER_CREATED: { sv: 'Användare skapad', en: 'User created' },
  USER_UPDATED: { sv: 'Användare uppdaterad', en: 'User updated' },
  USER_DELETED: { sv: 'Användare borttagen', en: 'User deleted' },
  USER_INVITED: { sv: 'Användare inbjuden', en: 'User invited' },
  INVITE_ACCEPTED: { sv: 'Inbjudan accepterad', en: 'Invite accepted' },
  INVITE_CANCELLED: { sv: 'Inbjudan avbruten', en: 'Invite cancelled' },
  INVITE_EXPIRED: { sv: 'Inbjudan utgången', en: 'Invite expired' },
  USER_REMOVED: { sv: 'Användare borttagen', en: 'User removed' },
  ROLE_CHANGED: { sv: 'Roll ändrad', en: 'Role changed' },
  STATUS_CHANGED: { sv: 'Status ändrad', en: 'Status changed' },
  // Organizations
  ORGANIZATION_CREATED: { sv: 'Organisation skapad', en: 'Organization created' },
  ORGANIZATION_UPDATED: { sv: 'Organisation uppdaterad', en: 'Organization updated' },
  ORGANIZATION_DELETED: { sv: 'Organisation borttagen', en: 'Organization deleted' },
  ORG_SETTINGS_UPDATED: { sv: 'Organisationsinställningar uppdaterade', en: 'Organization settings updated' },
  ORG_AUTH_SETTINGS_UPDATED: { sv: 'Autentiseringsinställningar uppdaterade', en: 'Authentication settings updated' },
  // Tenants / Distributors / Providers
  TENANT_CREATED: { sv: 'Tenant skapad', en: 'Tenant created' },
  TENANT_UPDATED: { sv: 'Tenant uppdaterad', en: 'Tenant updated' },
  TENANT_DELETED: { sv: 'Tenant borttagen', en: 'Tenant deleted' },
  TENANT_SETTINGS_UPDATED: { sv: 'Tenant-inställningar uppdaterade', en: 'Tenant settings updated' },
  SSO_CONFIGURED: { sv: 'SSO konfigurerad', en: 'SSO configured' },
  SSO_UPDATED: { sv: 'SSO uppdaterad', en: 'SSO updated' },
  SSO_REMOVED: { sv: 'SSO borttagen', en: 'SSO removed' },
  // Modules & Configuration
  MODULE_ENABLED: { sv: 'Modul aktiverad', en: 'Module enabled' },
  MODULE_DISABLED: { sv: 'Modul inaktiverad', en: 'Module disabled' },
  EMAIL_PROVIDER_CONFIGURED: { sv: 'E-postleverantör konfigurerad', en: 'Email provider configured' },
  EMAIL_PROVIDER_UPDATED: { sv: 'E-postleverantör uppdaterad', en: 'Email provider updated' },
  API_TOKEN_CREATED: { sv: 'API-token skapad', en: 'API token created' },
  API_TOKEN_REVOKED: { sv: 'API-token återkallad', en: 'API token revoked' },
  API_TOKEN_USED: { sv: 'API-token använd', en: 'API token used' },
  API_TOKEN_AUTH_FAILED: { sv: 'API-token autentisering misslyckades', en: 'API token auth failed' },
  API_KEY_ROTATED: { sv: 'API-nyckel roterad', en: 'API key rotated' },
  API_KEY_CREATED: { sv: 'API-nyckel skapad', en: 'API key created' },
  API_KEY_DELETED: { sv: 'API-nyckel borttagen', en: 'API key deleted' },
  // Context & Other
  CONTEXT_SWITCH: { sv: 'Kontextbyte', en: 'Context switch' },
  BILLING_UPDATED: { sv: 'Fakturering uppdaterad', en: 'Billing updated' }
}

/**
 * Get all org-visible event types including core + all registered modules.
 */
export function getAllOrgAuditEventTypes(): AuditEventType[] {
  return [...coreOrgAuditEventTypes, ...getOrgAuditEventTypes()]
}

/**
 * Get all event labels including core + all registered modules.
 */
export function getAllAuditEventLabels(): Record<string, AuditEventLabel> {
  return { ...coreAuditEventLabels, ...getAuditEventLabels() }
}

/**
 * Get all event types for admin views (includes all core + all layer events).
 */
export function getAllAdminAuditEventTypes(): AuditEventType[] {
  const layerEvents: AuditEventType[] = []
  for (const module of auditModules.values()) {
    layerEvents.push(...module.eventTypes)
  }
  return [...coreAllEventTypes, ...layerEvents]
}

/**
 * Get all modules (including core) for admin filtering.
 * Returns modules with their event types and labels.
 */
export function getAdminAuditModules(locale: 'sv' | 'en' = 'sv'): Array<{
  moduleKey: string
  moduleName: string
  eventTypes: Array<{
    type: AuditEventType
    label: string
  }>
}> {
  const result = []

  // Add core as a module
  result.push({
    moduleKey: 'core',
    moduleName: locale === 'sv' ? 'Kärna' : 'Core',
    eventTypes: coreAllEventTypes.map(type => ({
      type,
      label: coreAuditEventLabels[type]?.[locale] ?? type
    }))
  })

  // Add all registered layer modules
  for (const module of auditModules.values()) {
    result.push({
      moduleKey: module.moduleKey,
      moduleName: module.moduleName[locale],
      eventTypes: module.eventTypes.map(type => ({
        type,
        label: module.eventLabels[type]?.[locale] ?? type
      }))
    })
  }

  return result
}
