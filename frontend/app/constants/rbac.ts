export const rbacRoles = ['owner', 'admin', 'member', 'operator', 'viewer'] as const

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
  'cloudflare:read',
  'cloudflare:write',
  'containers:read',
  'containers:write',
  'vms:read',
  'vms:write',
  'wordpress:read',
  'wordpress:write',
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
    'users:manage',
    'cloudflare:read',
    'cloudflare:write',
    'containers:read',
    'containers:write',
    'vms:read',
    'vms:write',
    'wordpress:read',
    'wordpress:write',
    'audit:read'
  ],
  admin: [
    'org:read',
    'org:manage',
    'users:invite',
    'users:manage',
    'cloudflare:read',
    'cloudflare:write',
    'containers:read',
    'containers:write',
    'vms:read',
    'vms:write',
    'wordpress:read',
    'wordpress:write',
    'audit:read'
  ],
  member: ['org:read', 'cloudflare:read', 'containers:read', 'vms:read', 'wordpress:read'],
  operator: [
    'org:read',
    'cloudflare:read',
    'cloudflare:write',
    'containers:read',
    'containers:write',
    'vms:read',
    'wordpress:read',
    'wordpress:write'
  ],
  viewer: [
    'org:read',
    'cloudflare:read',
    'containers:read',
    'vms:read',
    'wordpress:read'
  ]
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
    'users:invite',
    'users:manage',
    'audit:read'
  ],
  user: [
    'org:read',
    'cloudflare:read',
    'containers:read',
    'vms:read',
    'wordpress:read'
  ],
  viewer: [
    'org:read',
    'tenants:read',
    'cloudflare:read',
    'containers:read',
    'vms:read',
    'wordpress:read'
  ],
  support: [
    'tenants:read',
    'org:read',
    'users:read',
    'audit:read'
  ],
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
    'users:manage',
    'cloudflare:read',
    'cloudflare:write',
    'containers:read',
    'containers:write',
    'vms:read',
    'vms:write',
    'wordpress:read',
    'wordpress:write',
    'audit:read'
  ],
  'msp-global-reader': [
    'tenants:read',
    'org:read',
    'cloudflare:read',
    'containers:read',
    'vms:read',
    'wordpress:read',
    'audit:read'
  ],
  'msp-cloudflare-admin': ['tenants:read', 'org:read', 'org:manage', 'cloudflare:read', 'cloudflare:write'],
  'msp-containers-admin': ['tenants:read', 'org:read', 'org:manage', 'containers:read', 'containers:write'],
  'msp-vms-admin': ['tenants:read', 'org:read', 'org:manage', 'vms:read', 'vms:write'],
  'msp-wordpress-admin': ['tenants:read', 'org:read', 'org:manage', 'wordpress:read', 'wordpress:write'],
  'msp-ncentral-admin': ['tenants:read', 'org:read', 'org:manage'],
  'msp-monitoring-admin': ['tenants:read', 'org:read', 'org:manage'],
  'msp-managed-server-admin': ['tenants:read', 'org:read', 'org:manage'],
  'msp-dns-containers-admin': [
    'tenants:read',
    'org:read',
    'org:manage',
    'cloudflare:read',
    'cloudflare:write',
    'containers:read',
    'containers:write'
  ],
  'msp-infrastructure-admin': [
    'tenants:read',
    'org:read',
    'org:manage',
    'containers:read',
    'containers:write',
    'vms:read',
    'vms:write',
    'wordpress:read',
    'wordpress:write'
  ],
  'msp-full-admin': [
    'tenants:read',
    'org:read',
    'org:manage',
    'org:billing',
    'users:invite',
    'users:manage',
    'cloudflare:read',
    'cloudflare:write',
    'containers:read',
    'containers:write',
    'vms:read',
    'vms:write',
    'wordpress:read',
    'wordpress:write',
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



