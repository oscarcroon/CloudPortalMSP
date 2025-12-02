export const rolePermissionMap = {
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
  viewer: ['org:read', 'cloudflare:read', 'containers:read', 'vms:read', 'wordpress:read']
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

