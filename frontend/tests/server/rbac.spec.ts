import { describe, expect, it } from 'vitest'
import { hasPermission } from '../../server/utils/rbac'
import { rolePermissionMap } from '~/constants/rbac'

describe('RBAC helpers', () => {
  it('returns true when role has the required permission', () => {
    expect(hasPermission('owner', 'cloudflare:write')).toBe(true)
  })

  it('returns false when role lacks the permission', () => {
    expect(hasPermission('viewer', 'users:manage')).toBe(false)
  })

  it('rolePermissionMap stay in sync with hasPermission', () => {
    for (const role of Object.keys(rolePermissionMap)) {
      const permissions = rolePermissionMap[role as keyof typeof rolePermissionMap]
      for (const permission of permissions) {
        expect(hasPermission(role as never, permission)).toBe(true)
      }
    }
  })
})

