import { describe, expect, it } from 'vitest'
import {
  serializeAuthSettings,
  stringifyIdpConfig
} from '~/server/api/admin/organizations/utils'
import { statusSchema } from '~/server/api/admin/organizations/[orgId]/members/[memberId]/status.patch'
import { deleteSchema } from '~/server/api/admin/organizations/[orgId]/delete.post'

describe('stringifyIdpConfig', () => {
  it('serializes valid objects', () => {
    const payload = { issuer: 'https://login.example.com', clientId: 'abc' }
    const result = stringifyIdpConfig(payload)
    expect(result).toEqual(JSON.stringify(payload))
  })

  it('returns null for undefined', () => {
    expect(stringifyIdpConfig(undefined)).toBeNull()
  })

  it('falls back to null on non-serializable input', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(stringifyIdpConfig(circular)).toBeNull()
  })
})

describe('serializeAuthSettings', () => {
  it('parses booleans and JSON safely', () => {
    const record = {
      organizationId: 'org_123',
      idpType: 'oidc',
      ssoEnforced: 1,
      allowLocalLoginForOwners: 0,
      idpConfig: '{"issuer":"https://login.example.com"}',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const result = serializeAuthSettings(record as any)
    expect(result).toEqual({
      organizationId: 'org_123',
      idpType: 'oidc',
      ssoEnforced: true,
      allowLocalLoginForOwners: false,
      idpConfig: { issuer: 'https://login.example.com' }
    })
  })

  it('returns null config when JSON is invalid', () => {
    const record = {
      organizationId: 'org_123',
      idpType: 'none',
      ssoEnforced: 0,
      allowLocalLoginForOwners: 1,
      idpConfig: '{invalid json}',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const result = serializeAuthSettings(record as any)
    expect(result.idpConfig).toBeNull()
  })
})

describe('statusSchema', () => {
  it('allows switching between active and suspended', () => {
    expect(statusSchema.parse({ status: 'active' })).toEqual({ status: 'active' })
    expect(statusSchema.parse({ status: 'suspended' })).toEqual({ status: 'suspended' })
  })

  it('rejects unsupported statuses', () => {
    expect(() => statusSchema.parse({ status: 'invited' as any })).toThrow()
  })
})

describe('deleteSchema', () => {
  it('requires a slug and explicit acknowledgement', () => {
    expect(deleteSchema.parse({ confirmSlug: 'org-123', acknowledgeImpact: true })).toEqual({
      confirmSlug: 'org-123',
      acknowledgeImpact: true
    })
  })

  it('fails when acknowledgement missing or slug tom', () => {
    expect(() => deleteSchema.parse({ confirmSlug: '', acknowledgeImpact: true })).toThrow()
    expect(() => deleteSchema.parse({ confirmSlug: 'org-123', acknowledgeImpact: false as any })).toThrow()
  })
})

