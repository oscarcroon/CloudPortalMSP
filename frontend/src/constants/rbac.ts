export const rbacRoles = ['owner', 'admin', 'member', 'operator', 'viewer'] as const

export type RbacRole = (typeof rbacRoles)[number]

// Scope-agnostic tenant roles
export const tenantRoles = ['admin', 'user', 'viewer', 'support'] as const

export type TenantRole = (typeof tenantRoles)[number]

export const rbacPermissions = [
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
  'audit:read',
  'tenants:read',
  'tenants:manage',
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
  ]
}



