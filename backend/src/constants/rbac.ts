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
export const tenantRoles = ['admin', 'user', 'viewer', 'support'] as const

export type TenantRole = (typeof tenantRoles)[number]

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
  ]
}

