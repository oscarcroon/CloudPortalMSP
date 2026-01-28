/**
 * Server-side module registry.
 * 
 * This is the single source of truth for module metadata used by:
 * - Setup wizard (listing available modules)
 * - Organization role templates (mapping permissions)
 * - Module visibility calculations
 */

import type { PluginModuleManifest, PluginModuleManifestPermission } from '~~/server/lib/plugin-registry/types'
import { manifests } from '../../layers/plugin-manifests'

export type ModuleRiskClass = 'high' | 'medium' | 'low'
export type ModuleScope = 'tenant' | 'org' | 'user'

export interface ModuleRegistryEntry {
  /** Unique module key (e.g., 'windows-dns') */
  id: string
  /** Display name */
  name: string
  /** Description of the module */
  description: string
  /** Category for grouping (e.g., 'dns', 'monitoring') */
  category: string
  /** Icon identifier (e.g., 'mdi:globe') */
  icon?: string
  /** Scopes where this module operates */
  scopes: ModuleScope[]
  /** Risk classification for role template defaults */
  riskClass: ModuleRiskClass
  /** All permissions defined by this module */
  permissions: ModulePermissionEntry[]
  /** Optional dependencies on other modules */
  dependsOn?: string[]
}

export interface ModulePermissionEntry {
  /** Permission key (e.g., 'windows-dns:view') */
  key: string
  /** Human-readable description */
  description?: string
  /** Label for UI */
  label?: string
  /** Permission action type (derived from key pattern) */
  action: 'read' | 'create' | 'update' | 'delete' | 'manage' | 'other'
}

/**
 * Derive action type from permission key.
 * Examples:
 * - 'windows-dns:view' -> 'read'
 * - 'windows-dns:zones:create' -> 'create'
 * - 'windows-dns:records:write' -> 'update'
 */
function deriveAction(key: string): ModulePermissionEntry['action'] {
  const lower = key.toLowerCase()
  if (lower.includes(':view') || lower.includes(':read') || lower.includes(':access')) {
    return 'read'
  }
  if (lower.includes(':create') || lower.includes(':import')) {
    return 'create'
  }
  if (lower.includes(':write') || lower.includes(':edit') || lower.includes(':update') || lower.includes(':sync')) {
    return 'update'
  }
  if (lower.includes(':delete')) {
    return 'delete'
  }
  if (lower.includes(':manage') || lower.includes(':config')) {
    return 'manage'
  }
  return 'other'
}

/**
 * Convert manifest permission to registry permission entry.
 */
function toPermissionEntry(perm: PluginModuleManifestPermission): ModulePermissionEntry {
  return {
    key: perm.key,
    description: perm.description,
    label: perm.label,
    action: deriveAction(perm.key)
  }
}

/**
 * Determine risk class based on module category and permissions.
 * High-risk: modules with manage/config/write permissions that affect infrastructure
 * Medium-risk: modules with write permissions
 * Low-risk: modules with primarily read permissions
 */
function determineRiskClass(manifest: PluginModuleManifest): ModuleRiskClass {
  const permissions = manifest.permissions
  const hasManage = permissions.some(p => 
    p.key.includes(':manage') || 
    p.key.includes(':config:edit') ||
    p.key.includes(':ownership:write')
  )
  const hasWrite = permissions.some(p => 
    p.key.includes(':write') || 
    p.key.includes(':create') || 
    p.key.includes(':delete')
  )
  
  // Infrastructure modules with management capabilities are high risk
  if (hasManage) {
    return 'high'
  }
  
  // Modules with write capabilities are medium risk
  if (hasWrite) {
    return 'medium'
  }
  
  return 'low'
}

/**
 * Convert plugin manifest to registry entry.
 */
function manifestToRegistryEntry(manifest: PluginModuleManifest): ModuleRegistryEntry {
  return {
    id: manifest.module.key,
    name: manifest.module.name,
    description: manifest.module.description ?? '',
    category: manifest.module.category ?? 'other',
    icon: manifest.module.icon,
    scopes: ['org', 'user'], // Default scopes for org-level modules
    riskClass: determineRiskClass(manifest),
    permissions: manifest.permissions.map(toPermissionEntry)
  }
}

// Build registry from manifests
const registryEntries: ModuleRegistryEntry[] = manifests.map(manifestToRegistryEntry)

// Create lookup map for fast access
const registryMap = new Map<string, ModuleRegistryEntry>(
  registryEntries.map(entry => [entry.id, entry])
)

/**
 * Get all modules in the registry.
 */
export function getAllRegistryModules(): ModuleRegistryEntry[] {
  return registryEntries
}

/**
 * Get a specific module by ID.
 */
export function getRegistryModule(moduleId: string): ModuleRegistryEntry | undefined {
  return registryMap.get(moduleId)
}

/**
 * Get modules filtered by scope.
 */
export function getRegistryModulesByScope(scope: ModuleScope): ModuleRegistryEntry[] {
  return registryEntries.filter(entry => entry.scopes.includes(scope))
}

/**
 * Get modules filtered by risk class.
 */
export function getRegistryModulesByRiskClass(riskClass: ModuleRiskClass): ModuleRegistryEntry[] {
  return registryEntries.filter(entry => entry.riskClass === riskClass)
}

/**
 * Get all module IDs.
 */
export function getAllModuleIds(): string[] {
  return registryEntries.map(entry => entry.id)
}

/**
 * Get "read" permission key for a module (for visibility checks).
 * Returns the first permission that is a read action, or undefined.
 */
export function getModuleReadPermission(moduleId: string): string | undefined {
  const entry = registryMap.get(moduleId)
  if (!entry) return undefined
  
  const readPerm = entry.permissions.find(p => p.action === 'read')
  return readPerm?.key
}

/**
 * Get all permission keys for a module.
 */
export function getModulePermissionKeys(moduleId: string): string[] {
  const entry = registryMap.get(moduleId)
  if (!entry) return []
  return entry.permissions.map(p => p.key)
}
