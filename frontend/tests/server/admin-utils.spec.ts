import { describe, expect, it } from 'vitest'
import {
  serializeAuthSettings,
  stringifyIdpConfig
} from '~/server/api/admin/organizations/utils'

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

