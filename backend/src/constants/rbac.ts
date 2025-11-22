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

