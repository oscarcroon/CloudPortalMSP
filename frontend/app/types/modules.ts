import type {
  ModuleMeta,
  ModuleRoleMeta,
  ModuleScope,
  ModuleStatus
} from '~/lib/module-registry'

export type PolicyMode = 'inherit' | 'default-closed' | 'allowlist' | 'blocked'

export interface ModulePolicy {
  moduleKey: string
  mode: PolicyMode
  allowedRoles: string[]
  allowedRolesSource?: string
  allowedPermissions?: string[]
  allowedPermissionsSource?: string
  permissionOverrides?: Record<string, boolean>
  enabled?: boolean
  disabled?: boolean
  comingSoonMessage?: string | null
}

export interface ModuleStatusDto {
  key: string
  name: string
  description: string
  category: string
  layerKey: string
  rootRoute: string
  status: ModuleStatus
  scopes: ModuleScope[]
  featureFlag?: string
  icon?: string | null
  requiredPermissions: string[]
  moduleRoles: ModuleRoleMeta[]
  roles?: ModuleRoleMeta[]
  tenantPolicy?: ModulePolicy
  orgPolicy?: ModulePolicy
  effectivePolicy: ModulePolicy
  tenantEnabled: boolean
  orgEnabled: boolean
  effectiveEnabled: boolean
  tenantDisabled?: boolean
  orgDisabled?: boolean
  effectiveDisabled?: boolean
  /** Resolved coming soon message from any level (global -> tenant -> org) */
  comingSoonMessage?: string | null
}

export type { ModuleMeta, ModuleRoleMeta, ModuleScope, ModuleStatus }


