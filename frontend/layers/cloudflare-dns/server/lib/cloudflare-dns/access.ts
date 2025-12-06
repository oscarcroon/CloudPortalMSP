import { and, eq, or } from 'drizzle-orm'
import { getModuleAccessForUser } from '~~/server/lib/modules/module-access'
import { getDb } from '~~/server/utils/db'
import { cloudflareDnsZoneAcls } from '~~/server/database/schema'
import type { ModuleRoleKeyMap } from '@/app/generated/rbac-types'
import type {
  CloudflareDnsModuleRole,
  CloudflareModuleRights,
  CloudflareZoneAccess,
  CloudflareZoneRole
} from './types'

const MODULE_ROLE_ORDER: CloudflareDnsModuleRole[] = [
  'viewer',
  'records-editor',
  'zone-admin',
  'module-admin'
]

const ZONE_ROLE_ORDER: CloudflareZoneRole[] = ['viewer', 'records-only', 'editor', 'admin']

const zoneRoleCapabilities: Record<CloudflareZoneRole, Omit<CloudflareZoneAccess, 'roles'>> = {
  viewer: {
    zoneRole: 'viewer',
    roles: [],
    canView: true,
    canEditRecords: false,
    canManageZones: false,
    canManageAcls: false,
    canManageOrgConfig: false
  },
  'records-only': {
    zoneRole: 'records-only',
    roles: [],
    canView: true,
    canEditRecords: true,
    canManageZones: false,
    canManageAcls: false,
    canManageOrgConfig: false
  },
  editor: {
    zoneRole: 'editor',
    roles: [],
    canView: true,
    canEditRecords: true,
    canManageZones: false,
    canManageAcls: false,
    canManageOrgConfig: false
  },
  admin: {
    zoneRole: 'admin',
    roles: [],
    canView: true,
    canEditRecords: true,
    canManageZones: true,
    canManageAcls: true,
    canManageOrgConfig: false
  }
}

const moduleRoleCapabilities: Record<CloudflareDnsModuleRole, CloudflareModuleRights> = {
  viewer: {
    roles: ['viewer'],
    canView: true,
    canEditRecords: false,
    canManageZones: false,
    canManageAcls: false,
    canManageOrgConfig: false
  },
  'records-editor': {
    roles: ['records-editor'],
    canView: true,
    canEditRecords: true,
    canManageZones: false,
    canManageAcls: false,
    canManageOrgConfig: false
  },
  'zone-admin': {
    roles: ['zone-admin'],
    canView: true,
    canEditRecords: true,
    canManageZones: true,
    canManageAcls: true,
    canManageOrgConfig: false
  },
  'module-admin': {
    roles: ['module-admin'],
    canView: true,
    canEditRecords: true,
    canManageZones: true,
    canManageAcls: true,
    canManageOrgConfig: true
  }
}

const mergeModuleRights = (roles: CloudflareDnsModuleRole[]): CloudflareModuleRights => {
  const rights: CloudflareModuleRights = {
    roles,
    canView: false,
    canEditRecords: false,
    canManageZones: false,
    canManageAcls: false,
    canManageOrgConfig: false
  }

  for (const role of roles) {
    const caps = moduleRoleCapabilities[role]
    rights.canView = rights.canView || caps.canView
    rights.canEditRecords = rights.canEditRecords || caps.canEditRecords
    rights.canManageZones = rights.canManageZones || caps.canManageZones
    rights.canManageAcls = rights.canManageAcls || caps.canManageAcls
    rights.canManageOrgConfig = rights.canManageOrgConfig || caps.canManageOrgConfig
  }

  return rights
}

const clampZoneCapabilities = (
  moduleRights: CloudflareModuleRights,
  zoneRole: CloudflareZoneRole | null
): CloudflareZoneAccess => {
  if (!zoneRole) {
    return { ...moduleRights, zoneRole: null }
  }

  const zoneCaps = zoneRoleCapabilities[zoneRole]
  return {
    roles: moduleRights.roles,
    zoneRole,
    canView: moduleRights.canView && zoneCaps.canView,
    canEditRecords: moduleRights.canEditRecords && zoneCaps.canEditRecords,
    canManageZones: moduleRights.canManageZones && zoneCaps.canManageZones,
    canManageAcls: moduleRights.canManageAcls && zoneCaps.canManageAcls,
    canManageOrgConfig: moduleRights.canManageOrgConfig && zoneCaps.canManageOrgConfig
  }
}

export const resolveModuleRights = (roles: CloudflareDnsModuleRole[]): CloudflareModuleRights =>
  mergeModuleRights(roles)

export const highestModuleRole = (roles: CloudflareDnsModuleRole[]) => {
  let best: CloudflareDnsModuleRole | null = null
  for (const role of roles) {
    if (!best) {
      best = role
      continue
    }
    if (MODULE_ROLE_ORDER.indexOf(role) > MODULE_ROLE_ORDER.indexOf(best)) {
      best = role
    }
  }
  return best
}

export const highestZoneRole = (roles: CloudflareZoneRole[]): CloudflareZoneRole | null => {
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

export const getCloudflareDnsModuleAccessForUser = async (orgId: string, userId: string) => {
  const moduleAccess = await getModuleAccessForUser(orgId, userId, 'cloudflare-dns')
  if (!moduleAccess.hasAccess) {
    return resolveModuleRights([])
  }
  return resolveModuleRights(moduleAccess.roles as ModuleRoleKeyMap['cloudflare-dns'][])
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


