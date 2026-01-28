import { describe, it, expect } from 'vitest'
import { sanitizeModuleIdList, isValidModuleId } from '~~/server/utils/modules'
import { moduleIds } from '~/constants/modules'

describe('modules utils', () => {
  it('validates module ids', () => {
    expect(isValidModuleId(moduleIds[0])).toBe(true)
    expect(isValidModuleId('unknown-module')).toBe(false)
  })

  it('deduplicates module ids and preserves order', () => {
    const list = sanitizeModuleIdList([
      moduleIds[0],
      'invalid-module',
      moduleIds[1],
      moduleIds[0]
    ])
    expect(list).toEqual([moduleIds[0], moduleIds[1]])
  })

  it('applies max limit when provided', () => {
    const list = sanitizeModuleIdList([...moduleIds], { max: 2 })
    expect(list).toHaveLength(2)
    expect(list).toEqual([moduleIds[0], moduleIds[1]])
  })
})


