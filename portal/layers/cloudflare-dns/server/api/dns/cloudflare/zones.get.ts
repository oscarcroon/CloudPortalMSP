import { createError, defineEventHandler, getQuery } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import {
  getCloudflareDnsModuleAccessForUser,
  getCloudflareDnsZoneAccessForUser
} from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getClientForOrg } from '@cloudflare-dns/server/lib/cloudflare-dns/client'
import { getZoneCache, upsertZoneCache } from '@cloudflare-dns/server/lib/cloudflare-dns/org-config'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }

  const orgId = auth.currentOrgId
  const orgRole = auth.orgRoles?.[orgId]
  const moduleRights = await getCloudflareDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'Ingen behörighet att se Cloudflare-zoner.' })
  }

  const query = getQuery(event)
  const forceRefresh =
    query?.refresh === '1' || query?.refresh === 'true' || query?.refresh === 'yes'

  // Always try cache first unless explicitly refreshed
  const cached = await getZoneCache(orgId)

  if (!forceRefresh && cached.length) {
    return {
      zones: cached.map((zone) => ({
        id: zone.zoneId,
        name: zone.name,
        status: zone.status ?? null,
        plan: zone.plan ?? null,
        recordCount: zone.recordCount ?? null,
        effectiveRole: null,
        canEdit: false,
        canManage: false,
        aclRestricted: false,
        access: {
          canManageAcls: false
        }
      })),
      moduleRights: {
        canManageZones: moduleRights.canManageZones,
        canEditRecords: moduleRights.canEditRecords,
        canExport: moduleRights.canExport,
        canManageAcls: moduleRights.canManageAcls,
        canManageOrgConfig: moduleRights.canManageOrgConfig
      },
      fromCache: true,
      stale: true
    }
  }

  let zones: Array<{ id: string; name: string; status: string | null; plan: string | null; recordCount: number | null }> = []
  try {
    const client = await getClientForOrg(orgId)
    const res = await client.listZones()
    const baseZones = res.zones ?? []

    // Enrich with record counts (per zone) but avoid hammering: do it once per refresh
    zones = await Promise.all(
      baseZones.map(async (zone) => {
        let recordCount = zone.recordCount ?? null
        try {
          const count = await client.countRecords(zone.id)
          if (count !== null && count !== undefined) {
            recordCount = count
          }
        } catch {
          // ignore count errors, keep null
        }
        return { id: zone.id, name: zone.name, status: zone.status ?? null, plan: zone.plan ?? null, recordCount }
      })
    )

    await upsertZoneCache(
      orgId,
      zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        status: zone.status ?? null,
        plan: zone.plan ?? null,
        recordCount: zone.recordCount ?? null
      }))
    )
  } catch (error: any) {
    if (cached.length) {
      // fallback to cache if API fails
      return {
        zones: cached.map((zone) => ({
          id: zone.zoneId,
          name: zone.name,
          status: zone.status ?? null,
          plan: zone.plan ?? null,
          recordCount: zone.recordCount ?? null,
          effectiveRole: null,
          canEdit: false,
          canManage: false,
          aclRestricted: false,
          access: {
            canManageAcls: false
          }
        })),
        moduleRights: {
          canManageZones: moduleRights.canManageZones,
          canEditRecords: moduleRights.canEditRecords,
          canManageAcls: moduleRights.canManageAcls,
          canManageOrgConfig: moduleRights.canManageOrgConfig
        },
        fromCache: true,
        stale: true,
        error: error?.message ?? 'Kunde inte hämta zoner från Cloudflare, visar cache.'
      }
    }
    throw error
  }

  const result = []

  for (const zone of zones) {
    const access = await getCloudflareDnsZoneAccessForUser(orgId, auth.user.id, orgRole, zone.id)
    if (!access.canView) continue

    result.push({
      id: zone.id,
      name: zone.name,
      status: zone.status ?? null,
      plan: zone.plan ?? null,
      recordCount: zone.recordCount ?? null,
      effectiveRole: access.zoneRole,
      canEdit: access.canEditRecords,
      canManage: access.canManageZones,
      aclRestricted: access.zoneRole !== null,
      access: {
        canManageAcls: access.canManageAcls
      }
    })
  }

  return {
    zones: result,
    moduleRights: {
      canManageZones: moduleRights.canManageZones,
      canEditRecords: moduleRights.canEditRecords,
      canManageAcls: moduleRights.canManageAcls,
      canManageOrgConfig: moduleRights.canManageOrgConfig
    }
  }
})


