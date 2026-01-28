import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { H3Event } from 'h3'

const dbCalls: { delete: any[]; insert: any[]; select?: any } = { delete: [], insert: [] }
const db = {
  select: () => ({
    from: () => ({
      where: async () => db.selectResult ?? [],
      leftJoin: () => ({
        leftJoin: () => ({
          where: async () => db.selectResult ?? []
        }),
        where: async () => db.selectResult ?? []
      })
    })
  }),
  delete: () => ({
    where: async (arg: any) => {
      dbCalls.delete.push(arg)
    }
  }),
  insert: () => ({
    values: async (rows: any) => {
      dbCalls.insert.push(rows)
    }
  }),
  selectResult: [] as any[]
}

let ensureAuthStateMock: any
let getOrganizationModulesStatusMock: any

vi.mock('~~/server/utils/db', () => ({
  getDb: () => db
}))

vi.mock('~~/server/utils/session', () => ({
  ensureAuthState: (...args: any[]) => ensureAuthStateMock?.(...args)
}))

vi.mock('~~/server/utils/modulePolicy', () => ({
  getOrganizationModulesStatus: (...args: any[]) => getOrganizationModulesStatusMock?.(...args)
}))

vi.mock('~~/server/lib/plugin-registry/registry', () => ({
  getPluginModuleByKey: (key: string) => ({
    key,
    name: key,
    description: '',
    category: 'test',
    layerKey: key,
    rootRoute: `/${key}`,
    scopes: ['org'],
    requiredPermissions: [],
    moduleRoles: []
  })
}))

import * as pluginAcl from '~~/server/utils/pluginAcl'

describe('pluginAcl utils', () => {
  const event = {} as H3Event

  beforeEach(() => {
    dbCalls.delete = []
    dbCalls.insert = []
    db.selectResult = []
    ensureAuthStateMock = undefined
    getOrganizationModulesStatusMock = undefined
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('hasPluginPermission returns true when row exists', async () => {
    db.selectResult = [{ id: 'row1' }]
    const result = await pluginAcl.hasPluginPermission('org1', 'plugin-a', 'read', ['g1'])
    expect(result).toBe(true)
  })

  it('hasPluginPermission returns false when no rows', async () => {
    db.selectResult = []
    const result = await pluginAcl.hasPluginPermission('org1', 'plugin-a', 'read', ['g1'])
    expect(result).toBe(false)
  })

  it('requirePluginPermission allows superadmin early', async () => {
    ensureAuthStateMock = async () => ({ user: { isSuperAdmin: true }, currentOrgId: 'org1' })
    const res = await pluginAcl.requirePluginPermission(event, 'plugin-a', 'read')
    expect(res.orgId).toBe('org1')
  })

  it('requirePluginPermission checks ACL for non-superadmin', async () => {
    ensureAuthStateMock = async () => ({
      user: { isSuperAdmin: false },
      currentOrgId: 'org1'
    })
    getOrganizationModulesStatusMock = async () => [{ key: 'plugin-a', effectiveEnabled: true }]
    db.selectResult = [{ id: 'row1', groupId: 'g1' }]

    const res = await pluginAcl.requirePluginPermission(event, 'plugin-a', 'read')
    expect(res.orgId).toBe('org1')
  })

  it('requirePluginPermission denies when no groups', async () => {
    ensureAuthStateMock = async () => ({
      user: { isSuperAdmin: false },
      currentOrgId: 'org1'
    })
    getOrganizationModulesStatusMock = async () => [{ key: 'plugin-a', effectiveEnabled: true }]
    vi.spyOn(pluginAcl, 'getUserOrgGroupIds').mockImplementation(async () => [])

    await expect(pluginAcl.requirePluginPermission(event, 'plugin-a', 'read')).rejects.toMatchObject({
      statusCode: 403
    })
  })

  it('upsertPluginAcl deletes previous rows and inserts deduped operations', async () => {
    const ops = {
      create: ['g1', 'g1'],
      read: ['g2'],
      update: [],
      delete: ['g3']
    }

    await pluginAcl.upsertPluginAcl({
      organizationId: 'org1',
      pluginKey: 'plugin-a',
      operations: ops
    })

    expect(dbCalls.delete.length).toBe(1)
    expect(dbCalls.insert.length).toBe(1)
    const inserted = dbCalls.insert[0] as any[]
    expect(inserted).toHaveLength(3)
    expect(inserted.map((row) => row.groupId).sort()).toEqual(['g1', 'g2', 'g3'])
    expect(inserted.map((row) => row.operation).sort()).toEqual(['create', 'delete', 'read'])
  })
})



