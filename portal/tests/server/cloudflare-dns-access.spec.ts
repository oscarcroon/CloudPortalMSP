import { describe, expect, it } from 'vitest'
import { highestZoneRole, resolveModuleRights } from '@cloudflare-dns/server/lib/cloudflare-dns/access'

describe('cloudflare-dns access helpers', () => {
  it('resolves module-admin capabilities', () => {
    const rights = resolveModuleRights(['module-admin'])
    expect(rights.canView).toBe(true)
    expect(rights.canEditRecords).toBe(true)
    expect(rights.canManageZones).toBe(true)
    expect(rights.canManageApi).toBe(true)
  })

  it('resolves viewer capabilities', () => {
    const rights = resolveModuleRights(['viewer'])
    expect(rights.canView).toBe(true)
    expect(rights.canEditRecords).toBe(false)
    expect(rights.canManageZones).toBe(false)
  })

  it('picks the strongest zone role', () => {
    const strongest = highestZoneRole(['viewer', 'editor', 'records-only', 'admin'])
    expect(strongest).toBe('admin')
  })
})


