import { describe, it, expect, vi } from 'vitest'
vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({
    loginBranding: {},
    public: {}
  })
}))
import { loginBrandingTestUtils } from '../../server/utils/loginBrandingResolver'

describe('loginBrandingResolver helpers', () => {
  describe('normalizeHost', () => {
    it('removes port and lowercases host', () => {
      expect(loginBrandingTestUtils.normalizeHost('Portal.CoreIT.Cloud:443')).toBe(
        'portal.coreit.cloud'
      )
    })

    it('returns null for empty values', () => {
      expect(loginBrandingTestUtils.normalizeHost('')).toBeNull()
      expect(loginBrandingTestUtils.normalizeHost(undefined)).toBeNull()
    })
  })

  describe('extractSlugFromHost', () => {
    const suffixes = ['.portal.coreit.cloud', '.example.com']

    it('extracts slug for configured suffix', () => {
      expect(
        loginBrandingTestUtils.extractSlugFromHost('gdm.portal.coreit.cloud', suffixes)
      ).toBe('gdm')
    })

    it('returns null when host does not match suffix', () => {
      expect(
        loginBrandingTestUtils.extractSlugFromHost('portal.coreit.cloud', suffixes)
      ).toBeNull()
    })
  })
})

