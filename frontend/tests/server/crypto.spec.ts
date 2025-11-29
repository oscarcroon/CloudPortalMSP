import { describe, expect, it } from 'vitest'
import { normalizeEmail } from '../../server/utils/crypto'

describe('crypto helpers', () => {
  it('normalizeEmail trims and lowercases', () => {
    expect(normalizeEmail(' Alice@Example.COM ')).toBe('alice@example.com')
  })
})

