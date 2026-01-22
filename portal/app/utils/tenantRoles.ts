import type { TenantRole } from '~/constants/rbac'
import { tenantRoles, tenantRolesWithIncludeChildren } from '~/constants/rbac'

export const MSP_TENANT_ROLES: TenantRole[] = tenantRoles.filter((role) =>
  role.startsWith('msp-')
) as TenantRole[]

export const TENANT_ROLES_WITH_INCLUDE_CHILDREN: TenantRole[] =
  tenantRolesWithIncludeChildren

const baseLabels: Record<TenantRole, string> = {
  admin: 'Administratör',
  user: 'Användare',
  viewer: 'Läsare',
  support: 'Support',
  'msp-global-admin': 'MSP Global Admin',
  'msp-global-reader': 'MSP Global Reader',
  'msp-cloudflare-admin': 'MSP DNS Admin',
  'msp-containers-admin': 'MSP Containers Admin',
  'msp-vms-admin': 'MSP VMs Admin',
  'msp-wordpress-admin': 'MSP WordPress Admin',
  'msp-ncentral-admin': 'MSP nCentral Admin',
  'msp-monitoring-admin': 'MSP Monitoring Admin',
  'msp-managed-server-admin': 'MSP Managed Server Admin',
  'msp-dns-containers-admin': 'MSP DNS + Containers Admin',
  'msp-infrastructure-admin': 'MSP Infrastructure Admin',
  'msp-full-admin': 'MSP Full Admin'
}

export const getTenantRoleLabel = (role: string | TenantRole): string => {
  return baseLabels[role as TenantRole] ?? role
}

