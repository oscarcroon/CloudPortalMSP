import { describe, it, expect } from 'vitest'
import { getTenantAuditScope } from '../../server/utils/auditScope'

describe('getTenantAuditScope', () => {
  it('inkluderar leverantörs-tenants och orgar för distributörer', async () => {
    const scope = await getTenantAuditScope('dist-1', {
      fetchTenant: async () => ({
        id: 'dist-1',
        type: 'distributor',
        parentTenantId: null
      }),
      fetchProviders: async () => ['prov-1', 'prov-2'],
      fetchOrganizations: async () => ['org-1', 'org-2', 'org-3']
    })

    expect(scope.tenantType).toBe('distributor')
    expect(scope.providerTenantIds).toEqual(['prov-1', 'prov-2'])
    expect(scope.orgIds).toEqual(['org-1', 'org-2', 'org-3'])
    expect(scope.selfTenantIds).toEqual(['dist-1'])
  })

  it('faller tillbaka till endast egen tenant för leverantörer', async () => {
    const scope = await getTenantAuditScope('prov-9', {
      fetchTenant: async () => ({
        id: 'prov-9',
        type: 'provider',
        parentTenantId: null
      }),
      fetchProviders: async () => [],
      fetchOrganizations: async () => ['org-9']
    })

    expect(scope.tenantType).toBe('provider')
    expect(scope.providerTenantIds).toEqual([])
    expect(scope.orgIds).toEqual(['org-9'])
    expect(scope.selfTenantIds).toEqual(['prov-9'])
  })

  it('kastar 404 om tenant saknas', async () => {
    await expect(
      getTenantAuditScope('missing', {
        fetchTenant: async () => undefined,
        fetchProviders: async () => [],
        fetchOrganizations: async () => []
      })
    ).rejects.toThrowError(/Tenant not found/)
  })
})

