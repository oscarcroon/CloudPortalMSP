export const rbacRoles = ['owner', 'admin', 'operator', 'member', 'viewer', 'support'] as const

export type RbacRole = (typeof rbacRoles)[number]

// Scope-agnostic tenant roles
export const tenantRoles = [
  'admin',
  'user',
  'viewer',
  'support',
  'msp-global-admin',
  'msp-global-reader',
  'msp-cloudflare-admin',
  'msp-containers-admin',
  'msp-vms-admin',
  'msp-wordpress-admin',
  'msp-ncentral-admin',
  'msp-monitoring-admin',
  'msp-managed-server-admin',
  'msp-dns-containers-admin',
  'msp-infrastructure-admin',
  'msp-full-admin'
] as const

export const standardTenantRoles = ['admin', 'user', 'viewer', 'support'] as const

export type TenantRole = (typeof tenantRoles)[number]

export const tenantRolesWithIncludeChildren: TenantRole[] = [
  'admin',
  'user',
  'viewer',
  'support',
  'msp-global-admin',
  'msp-global-reader',
  'msp-cloudflare-admin',
  'msp-containers-admin',
  'msp-vms-admin',
  'msp-wordpress-admin',
  'msp-ncentral-admin',
  'msp-monitoring-admin',
  'msp-managed-server-admin',
  'msp-dns-containers-admin',
  'msp-infrastructure-admin',
  'msp-full-admin'
]

export const rbacPermissions = [
  'org:read',
  'org:manage',
  'org:billing',
  'users:invite',
  'users:read',
  'users:manage',
  'audit:read',
  'tenants:read',
  'tenants:manage',
  'tenants:manage-members',
  'tenants:create-distributor',
  'tenants:create-provider',
  'tenants:create-customer'
] as const

export type RbacPermission = (typeof rbacPermissions)[number]

export const rolePermissionMap: Record<RbacRole, RbacPermission[]> = {
  owner: [
    'org:read',
    'org:manage',
    'org:billing',
    'users:invite',
    'users:read',
    'users:manage',
    'audit:read'
  ],
  admin: [
    'org:read',
    'org:manage',
    'users:invite',
    'users:read',
    'users:manage',
    'audit:read'
  ],
  operator: ['org:read', 'users:read'],
  member: ['org:read'],
  viewer: ['org:read'],
  support: ['org:read', 'users:read', 'audit:read']
}

export const defaultRole: RbacRole = 'member'

// Scope-based tenant role permissions
// These permissions apply within the tenant scope (with includeChildren if set)
export const tenantRolePermissionMap: Record<TenantRole, RbacPermission[]> = {
  admin: [
    'tenants:read',
    'tenants:manage',
    'tenants:manage-members',
    'tenants:create-distributor',
    'tenants:create-provider',
    'tenants:create-customer',
    'org:read',
    'org:manage',
    'org:billing',
    'users:invite',
    'users:read',
    'users:manage',
    'audit:read'
  ],
  user: ['org:read'],
  viewer: ['org:read', 'tenants:read'],
  support: ['tenants:read', 'org:read', 'users:read', 'audit:read'],
  'msp-global-admin': [
    'tenants:read',
    'tenants:manage',
    'tenants:manage-members',
    'tenants:create-distributor',
    'tenants:create-provider',
    'tenants:create-customer',
    'org:read',
    'org:manage',
    'org:billing',
    'users:invite',
    'users:read',
    'users:manage',
    'audit:read'
  ],
  'msp-global-reader': ['tenants:read', 'org:read', 'audit:read'],
  'msp-cloudflare-admin': ['tenants:read', 'org:read', 'org:manage', 'users:read'],
  'msp-containers-admin': ['tenants:read', 'org:read', 'org:manage', 'users:read'],
  'msp-vms-admin': ['tenants:read', 'org:read', 'org:manage', 'users:read'],
  'msp-wordpress-admin': ['tenants:read', 'org:read', 'org:manage', 'users:read'],
  'msp-ncentral-admin': ['tenants:read', 'org:read', 'org:manage', 'users:read'],
  'msp-monitoring-admin': ['tenants:read', 'org:read', 'org:manage', 'users:read'],
  'msp-managed-server-admin': ['tenants:read', 'org:read', 'org:manage', 'users:read'],
  'msp-dns-containers-admin': ['tenants:read', 'org:read', 'org:manage', 'users:read'],
  'msp-infrastructure-admin': ['tenants:read', 'org:read', 'org:manage', 'users:read'],
  'msp-full-admin': [
    'tenants:read',
    'tenants:manage',
    'tenants:manage-members',
    'tenants:create-distributor',
    'tenants:create-provider',
    'tenants:create-customer',
    'org:read',
    'org:manage',
    'org:billing',
    'users:invite',
    'users:read',
    'users:manage',
    'audit:read'
  ]
}

export const tenantRoleOrgProxyPermissions: Record<TenantRole, RbacPermission[]> = {
  admin: ['org:read', 'org:manage'],
  user: ['org:read'],
  viewer: ['org:read'],
  support: ['org:read'],
  'msp-global-admin': ['org:read', 'org:manage'],
  'msp-global-reader': ['org:read'],
  'msp-cloudflare-admin': ['org:read', 'org:manage'],
  'msp-containers-admin': ['org:read', 'org:manage'],
  'msp-vms-admin': ['org:read', 'org:manage'],
  'msp-wordpress-admin': ['org:read', 'org:manage'],
  'msp-ncentral-admin': ['org:read', 'org:manage'],
  'msp-monitoring-admin': ['org:read', 'org:manage'],
  'msp-managed-server-admin': ['org:read', 'org:manage'],
  'msp-dns-containers-admin': ['org:read', 'org:manage'],
  'msp-infrastructure-admin': ['org:read', 'org:manage'],
  'msp-full-admin': ['org:read', 'org:manage']
}



