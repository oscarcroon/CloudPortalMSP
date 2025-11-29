import { describe, expect, it } from 'vitest'
import {
  assertRequireSsoAllowed,
  hasConfiguredIdp,
  prepareIdpConfigForStorage
} from '../../server/utils/idp'

describe('IdP helpers', () => {
  it('sanitizes Entra ID config with issuer and metadata defaults', () => {
    const config = prepareIdpConfigForStorage('oidc', {
      provider: 'entra',
      tenantId: 'c715d35d-4479-4a9d-90e3-5ef1f087c3d0',
      clientId: 'client',
      clientSecret: 'secret',
      redirectUri: 'https://app.example.com/api/auth/sso/acme/callback'
    })

    expect(config).toBeTruthy()
    expect(config?.issuer).toBe(
      'https://login.microsoftonline.com/c715d35d-4479-4a9d-90e3-5ef1f087c3d0/v2.0'
    )
    expect(config?.metadataUrl).toBe(
      'https://login.microsoftonline.com/c715d35d-4479-4a9d-90e3-5ef1f087c3d0/v2.0/.well-known/openid-configuration'
    )
  })

  it('detects when an OIDC provider is correctly configured', () => {
    const config = {
      provider: 'openid',
      issuer: 'https://idp.example.com',
      clientId: 'client',
      clientSecret: 'secret',
      redirectUri: 'https://portal.example.com/api/auth/sso/acme/callback'
    }

    expect(hasConfiguredIdp('oidc', config)).toBe(true)
    expect(() =>
      assertRequireSsoAllowed({
        requireSso: true,
        idpType: 'oidc',
        idpConfig: config
      })
    ).not.toThrow()
  })

  it('rejects enforcing SSO when IdP is missing', () => {
    expect(() =>
      assertRequireSsoAllowed({
        requireSso: true,
        idpType: 'none',
        idpConfig: null
      })
    ).toThrow()
  })
})

