import { describe, it, expect } from 'vitest'
import { normalizePermissionOverrides } from '~/server/utils/userModulePermissions'

describe('normalizePermissionOverrides', () => {
  it('converts legacy boolean map to denies', () => {
    const result = normalizePermissionOverrides({
      'cloudflare-dns:view': true,
      'cloudflare-dns:edit_records': false
    })

    expect(result).toEqual({
      grants: [],
      denies: ['cloudflare-dns:view']
    })
  })

  it('keeps grants/denies arrays and deduplicates', () => {
    const result = normalizePermissionOverrides({
      grants: ['cloudflare-dns:view', 'cloudflare-dns:view', ''],
      denies: ['cloudflare-dns:admin_zones', 'other', 'cloudflare-dns:admin_zones']
    })

    expect(result).toEqual({
      grants: ['cloudflare-dns:view'],
      denies: ['cloudflare-dns:admin_zones', 'other']
    })
  })

  it('returns null when nothing valid is provided', () => {
    const result = normalizePermissionOverrides(null)
    expect(result).toBeNull()
  })
})


