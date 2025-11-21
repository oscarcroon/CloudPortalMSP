export const rbacRoles = ['owner', 'admin', 'operator', 'viewer'] as const

export type RbacRole = (typeof rbacRoles)[number]

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
  'audit:read'
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

export const defaultRole: RbacRole = 'viewer'



