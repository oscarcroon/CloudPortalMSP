import { describe, it, expect } from 'vitest'
import { resolveModuleRoleState } from '~/server/utils/moduleRoleState'

describe('resolveModuleRoleState', () => {
  it('filters defaults to allowedRoles when allowlist is set', () => {
    const state = resolveModuleRoleState({
      defaultRoles: ['reader', 'editor'],
      overrides: undefined,
      allowedRoles: ['reader']
    })

    expect(state.defaultRoles).toEqual(['reader'])
    expect(state.effectiveRoles).toEqual(['reader'])
  })

  it('applies grants within allowlist and ignores out-of-scope grants', () => {
    const state = resolveModuleRoleState({
      defaultRoles: [],
      overrides: { grants: new Set(['editor']), denies: new Set() },
      allowedRoles: ['reader']
    })

    expect(state.effectiveRoles).toEqual([])
    expect(state.source).toBe('none')
  })

  it('applies denies to defaults', () => {
    const state = resolveModuleRoleState({
      defaultRoles: ['reader', 'editor'],
      overrides: { grants: new Set(), denies: new Set(['reader']) },
      allowedRoles: null
    })

    expect(state.effectiveRoles).toEqual(['editor'])
    expect(state.source).toBe('custom')
  })
})





