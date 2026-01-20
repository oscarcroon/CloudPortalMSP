import { and, eq, or } from 'drizzle-orm'
import { getDb } from '../../../../../server/utils/db'
import { cloudflareDnsZoneAcls } from '../../../../../server/database/schema'
import { resolveEffectiveModulePermissions } from '../../../../../server/utils/modulePermissions'
import { clampBooleanCapabilities } from '../../../../../server/utils/resourceAcl'
import type {
  CloudflareModuleRights,
  CloudflareZoneAccess,
  CloudflareZoneRole
} from './types'

const ZONE_ROLE_ORDER: CloudflareZoneRole[] = ['viewer', 'records-only', 'editor', 'admin']

const PERMISSION_TO_CAPABILITY: Record<string, keyof CloudflareModuleRights> = {
  'cloudflare-dns:view': 'canView',
  'cloudflare-dns:edit_records': 'canEditRecords',
  'cloudflare-dns:admin_zones': 'canManageZones',
  'cloudflare-dns:manage_org_config': 'canManageOrgConfig',
  'cloudflare-dns:manage_acls': 'canManageAcls'
}

const zoneRoleCapabilities: Record<CloudflareZoneRole, Omit<CloudflareZoneAccess, 'roles'>> = {
  viewer: {
    zoneRole: 'viewer',
    canView: true,
    canEditRecords: false,
    canManageZones: false,
    canManageAcls: false,
    canManageOrgConfig: false
  },
  'records-only': {
    zoneRole: 'records-only',
    canView: true,
    canEditRecords: true,
    canManageZones: false,
    canManageAcls: false,
    canManageOrgConfig: false
  },
  editor: {
    zoneRole: 'editor',
    canView: true,
    canEditRecords: true,
    canManageZones: false,
    canManageAcls: false,
    canManageOrgConfig: false
  },
  admin: {
    zoneRole: 'admin',
    canView: true,
    canEditRecords: true,
    canManageZones: true,
    canManageAcls: true,
    canManageOrgConfig: false
  }
}

const highestZoneRole = (roles: CloudflareZoneRole[]): CloudflareZoneRole | null => {
  let best: CloudflareZoneRole | null = null
  for (const role of roles) {
    if (!best) {
      best = role
      continue
    }
    if (ZONE_ROLE_ORDER.indexOf(role) > ZONE_ROLE_ORDER.indexOf(best)) {
      best = role
    }
  }
  return best
}

const clampZoneCapabilities = (
  moduleRights: CloudflareModuleRights,
  zoneRole: CloudflareZoneRole | null
): CloudflareZoneAccess => {
  if (!zoneRole) {
    return { ...moduleRights, zoneRole: null }
  }

  const zoneCaps = zoneRoleCapabilities[zoneRole]
  const { roles, ...moduleBooleanCaps } = moduleRights
  const clamped = clampBooleanCapabilities(moduleBooleanCaps, zoneCaps)
  return { ...clamped, roles: [], zoneRole }
}

const buildRightsFromPermissions = (perms: Set<string>): CloudflareModuleRights => ({
  roles: [],
  canView: perms.has('cloudflare-dns:view'),
  canEditRecords: perms.has('cloudflare-dns:edit_records'),
  canManageZones: perms.has('cloudflare-dns:admin_zones'),
  canManageAcls: perms.has('cloudflare-dns:manage_acls'),
  canManageOrgConfig: perms.has('cloudflare-dns:manage_org_config')
})

export const getCloudflareDnsModuleAccessForUser = async (orgId: string, userId: string) => {
  const perms = await resolveEffectiveModulePermissions({ orgId, moduleKey: 'cloudflare-dns', userId })
  return buildRightsFromPermissions(perms.effectivePermissions)
}

export const getCloudflareDnsZoneAccessForUser = async (
  orgId: string,
  userId: string,
  orgRole: string | undefined,
  zoneId: string
): Promise<CloudflareZoneAccess> => {
  const moduleRights = await getCloudflareDnsModuleAccessForUser(orgId, userId)
  if (!moduleRights.canView) {
    return { ...moduleRights, zoneRole: null }
  }

  const db = getDb()
  const principalPredicates = [
    and(eq(cloudflareDnsZoneAcls.principalType, 'user'), eq(cloudflareDnsZoneAcls.principalId, userId))
  ]
  if (orgRole) {
    principalPredicates.push(
      and(eq(cloudflareDnsZoneAcls.principalType, 'org-role'), eq(cloudflareDnsZoneAcls.principalId, orgRole))
    )
  }

  const rows = await db
    .select({
      role: cloudflareDnsZoneAcls.role
    })
    .from(cloudflareDnsZoneAcls)
    .where(
      and(
        eq(cloudflareDnsZoneAcls.organizationId, orgId),
        eq(cloudflareDnsZoneAcls.zoneId, zoneId),
        principalPredicates.length > 1 ? or(...principalPredicates) : principalPredicates[0]
      )
    )

  const zoneRole = rows.length
    ? highestZoneRole(rows.map((row) => row.role as CloudflareZoneRole))
    : null

  return clampZoneCapabilities(moduleRights, zoneRole)
}


