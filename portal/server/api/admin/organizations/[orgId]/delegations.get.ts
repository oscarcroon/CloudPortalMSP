import { defineEventHandler, getQuery } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { mspOrgDelegations, mspOrgDelegationPermissions, organizations, users } from '~~/server/database/schema'
import { parseOrgParam, requireOrganizationByIdentifier, requireOrganizationReadAccess } from '../utils'

export default defineEventHandler(async (event) => {
  const orgParam = parseOrgParam(event)
  const query = getQuery(event)
  const includeRevoked = String(query.revoked ?? 'false') === 'true'

  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - allows superadmins and tenant admins
  await requireOrganizationReadAccess(event, organization)
  
  const rows = await db
    .select({
      delegation: mspOrgDelegations,
      org: organizations,
      user: users
    })
    .from(mspOrgDelegations)
    .innerJoin(organizations, eq(organizations.id, mspOrgDelegations.orgId))
    .leftJoin(
      users,
      and(eq(users.id, mspOrgDelegations.subjectId), eq(mspOrgDelegations.subjectType, 'user'))
    )
    .where(
      and(
        eq(mspOrgDelegations.orgId, organization.id),
        includeRevoked
          ? eq(mspOrgDelegations.orgId, organization.id)
          : isNull(mspOrgDelegations.revokedAt)
      )
    )

  const delegations = await Promise.all(
    rows.map(async (row) => {
      const perms = await db
        .select({ permissionKey: mspOrgDelegationPermissions.permissionKey })
        .from(mspOrgDelegationPermissions)
        .where(eq(mspOrgDelegationPermissions.delegationId, row.delegation.id))
      return {
        id: row.delegation.id,
        orgId: row.delegation.orgId,
        subjectType: row.delegation.subjectType,
        subjectId: row.delegation.subjectId,
        subjectEmail: row.user?.email ?? null,
        subjectName: row.user?.fullName ?? null,
        createdBy: row.delegation.createdBy,
        createdAt: row.delegation.createdAt,
        expiresAt: row.delegation.expiresAt,
        note: row.delegation.note,
        revokedAt: row.delegation.revokedAt,
        revokedBy: row.delegation.revokedBy,
        permissions: perms.map((p) => p.permissionKey)
      }
    })
  )

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug
    },
    delegations
  }
})



