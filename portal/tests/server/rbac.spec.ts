import { describe, it, expect, beforeEach } from 'vitest'
import { hasPermission, hasTenantPermission } from '../../server/utils/rbac'
import type { RbacRole, TenantRole, RbacPermission } from '../../app/constants/rbac'

describe('RBAC Permission Checks', () => {
  describe('hasPermission', () => {
    it('should return true for owner role with org:read permission', () => {
      expect(hasPermission('owner', 'org:read')).toBe(true)
    })

    it('should return true for owner role with org:manage permission', () => {
      expect(hasPermission('owner', 'org:manage')).toBe(true)
    })

    it('should return false for viewer role with org:manage permission', () => {
      expect(hasPermission('viewer', 'org:manage')).toBe(false)
    })

    it('should return false for invalid permission', () => {
      expect(hasPermission('owner', 'invalid:permission' as RbacPermission)).toBe(false)
    })
  })

  describe('hasTenantPermission', () => {
    it('should return true for admin tenant role with tenants:read permission', () => {
      expect(hasTenantPermission('admin', 'tenants:read')).toBe(true)
    })

    it('should return true for admin tenant role with tenants:manage permission', () => {
      expect(hasTenantPermission('admin', 'tenants:manage')).toBe(true)
    })

    it('should return false for viewer tenant role with tenants:manage permission', () => {
      expect(hasTenantPermission('viewer', 'tenants:manage')).toBe(false)
    })

    it('should return true for user tenant role with org:read permission', () => {
      expect(hasTenantPermission('user', 'org:read')).toBe(true)
    })
  })
})
