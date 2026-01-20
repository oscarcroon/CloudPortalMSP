export const rolePermissionMap = {
  owner: [
    'org:read',
    'org:manage',
    'org:billing',
    'users:invite',
    'users:read',
    'users:manage',
    'audit:read',
    'cloudflare:read',
    'cloudflare:write',
    'containers:read',
    'containers:write',
    'vms:read',
    'vms:write',
    'wordpress:read',
    'wordpress:write'
  ],
  admin: [
    'org:read',
    'org:manage',
    'users:invite',
    'users:read',
    'users:manage',
    'audit:read',
    'cloudflare:read',
    'cloudflare:write',
    'containers:read',
    'containers:write',
    'vms:read',
    'vms:write',
    'wordpress:read',
    'wordpress:write'
  ],
  operator: ['org:read', 'users:read'],
  member: ['org:read'],
  viewer: ['org:read'],
  support: ['org:read', 'users:read', 'audit:read']
} as const

export type BackendRole = keyof typeof rolePermissionMap

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

// Scope-based tenant role permissions
// These permissions apply within the tenant scope (with includeChildren if set)
export const tenantRolePermissionMap: Record<TenantRole, string[]> = {
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

export type OrgPermission = (typeof rolePermissionMap)[keyof typeof rolePermissionMap][number]

export const tenantRoleOrgProxyPermissions: Record<TenantRole, OrgPermission[]> = {
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

