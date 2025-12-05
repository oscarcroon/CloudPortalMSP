import { and, eq, or } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { windowsDnsZoneMemberships } from '~~/server/database/schema'
import {
  clampResourceRole,
  maxResourceRole,
  RESOURCE_ROLE_ORDER,
  type ResourceAccessResult,
  type ResourceRole
} from '~~/server/lib/acl/fine-grained'
import { getWindowsDnsModuleAccessForUser } from './windows-dns-access'

export async function getWindowsDnsZoneAccessForUser(
  orgId: string,
  userId: string,
  userOrgRole: string,
  zoneId: string
): Promise<ResourceAccessResult> {
  const moduleAccess = await getWindowsDnsModuleAccessForUser(orgId, userId)
  if (!moduleAccess.hasAccess) {
    return {
      canView: false,
      canEdit: false,
      canManage: false,
      effectiveRole: null
    }
  }

  const baseModuleRole = maxResourceRole(moduleAccess.roles as ResourceRole[])
  if (!baseModuleRole) {
    return {
      canView: false,
      canEdit: false,
      canManage: false,
      effectiveRole: null
    }
  }

  const db = getDb()

  const aclRows = await db
    .select()
    .from(windowsDnsZoneMemberships)
    .where(
      and(
        eq(windowsDnsZoneMemberships.organizationId, orgId),
        eq(windowsDnsZoneMemberships.zoneId, zoneId),
        or(
          and(
            eq(windowsDnsZoneMemberships.principalType, 'user'),
            eq(windowsDnsZoneMemberships.principalId, userId)
          ),
          and(
            eq(windowsDnsZoneMemberships.principalType, 'org-role'),
            eq(windowsDnsZoneMemberships.principalId, userOrgRole)
          )
        )
      )
    )

  // Open zone (no ACL rows) → inherit module role
  if (!aclRows.length) {
    const effectiveRole = baseModuleRole
    return {
      effectiveRole,
      canView: RESOURCE_ROLE_ORDER.indexOf(effectiveRole) >= RESOURCE_ROLE_ORDER.indexOf('viewer'),
      canEdit: RESOURCE_ROLE_ORDER.indexOf(effectiveRole) >= RESOURCE_ROLE_ORDER.indexOf('editor'),
      canManage: RESOURCE_ROLE_ORDER.indexOf(effectiveRole) >= RESOURCE_ROLE_ORDER.indexOf('admin')
    }
  }

  // Locked zone
  const zoneAclRole = maxResourceRole(aclRows.map((row) => row.role as ResourceRole) ?? [])

  if (!zoneAclRole) {
    return {
      canView: false,
      canEdit: false,
      canManage: false,
      effectiveRole: null
    }
  }

  const effectiveRole = clampResourceRole(zoneAclRole, baseModuleRole)

  return {
    effectiveRole,
    canView: RESOURCE_ROLE_ORDER.indexOf(effectiveRole) >= RESOURCE_ROLE_ORDER.indexOf('viewer'),
    canEdit: RESOURCE_ROLE_ORDER.indexOf(effectiveRole) >= RESOURCE_ROLE_ORDER.indexOf('editor'),
    canManage: RESOURCE_ROLE_ORDER.indexOf(effectiveRole) >= RESOURCE_ROLE_ORDER.indexOf('admin')
  }
}


