import { describe, expect, it } from 'vitest'
import { passwordSchema } from '~~/server/utils/password'

describe('passwordSchema', () => {
  it('accepts strong passwords', () => {
    expect(() => passwordSchema.parse('StrongPassw0rd!')).not.toThrow()
  })

  it('rejects too short passwords', () => {
    expect(() => passwordSchema.parse('Short1!')).toThrow()
  })

  it('requires mixed character classes', () => {
    expect(() => passwordSchema.parse('alllowercase123!')).toThrow()
    expect(() => passwordSchema.parse('ALLUPPERCASE123!')).toThrow()
    expect(() => passwordSchema.parse('NoDigitsHere!!')).toThrow()
    expect(() => passwordSchema.parse('NoSymbols1234')).toThrow()
  })
})


