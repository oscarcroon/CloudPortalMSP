import { createError, defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { requireSuperAdmin } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import {
  mspOrgDelegations,
  mspOrgDelegationPermissions,
  modulePermissions,
  organizations,
  users
} from '~~/server/database/schema'
import { createId } from '@paralleldrive/cuid2'
import { parseOrgParam, requireOrganizationByIdentifier } from '../utils'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const db = getDb()
  const orgParam = parseOrgParam(event)
  const org = await requireOrganizationByIdentifier(db, orgParam)

  const body = await readBody<{
    subjectType?: 'user'
    subjectId?: string
    permissionKeys?: string[]
    expiresAt?: number | null
    note?: string | null
  }>(event)

  if (!body?.subjectId) {
    throw createError({ statusCode: 400, message: 'subjectId is required' })
  }

  const [subject] = await db.select().from(users).where(eq(users.id, body.subjectId))
  if (!subject) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const subjectType = body.subjectType ?? 'user'
  if (subjectType !== 'user') {
    throw createError({ statusCode: 400, message: 'Only subjectType \"user\" is supported now' })
  }

  const permissionKeys = Array.from(new Set(body.permissionKeys ?? [])).filter(Boolean)
  if (permissionKeys.length === 0) {
    throw createError({ statusCode: 400, message: 'permissionKeys is required' })
  }

  // Validate permission keys exist
  const validKeys = await db.select({ permissionKey: modulePermissions.permissionKey }).from(modulePermissions)

  const validSet = new Set(validKeys.map((p) => p.permissionKey))
  for (const key of permissionKeys) {
    if (!validSet.has(key)) {
      throw createError({ statusCode: 400, message: `Unknown permission: ${key}` })
    }
  }

  const delegationId = createId()
  const now = Date.now()
  await db.insert(mspOrgDelegations).values({
    id: delegationId,
    orgId: org.id,
    subjectType,
    subjectId: body.subjectId,
    createdBy: null,
    expiresAt: body.expiresAt ?? null,
    note: body.note ?? null,
    revokedAt: null,
    revokedBy: null,
    createdAt: now,
    updatedAt: now
  })

  await db.insert(mspOrgDelegationPermissions).values(
    permissionKeys.map((permissionKey) => ({
      delegationId,
      permissionKey
    }))
  )

  return {
    id: delegationId,
    orgId: org.id,
    subjectType,
    subjectId: body.subjectId,
    subjectEmail: subject.email ?? null,
    subjectName: subject.fullName ?? null,
    permissionKeys,
    expiresAt: body.expiresAt ?? null,
    note: body.note ?? null
  }
})


