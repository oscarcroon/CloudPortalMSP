import { createError, defineEventHandler, getQuery } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { getOrgConfig, saveOrgConfig } from '@windows-dns/server/lib/windows-dns/org-config'
import { ensureAccount } from '@windows-dns/server/lib/windows-dns/client'
import { deriveTokenScopes } from '@windows-dns/server/lib/windows-dns/permissions-map'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canView) {
    throw createError({ statusCode: 403, message: 'No permission to view Windows DNS zones.' })
  }

  // Get org config
  let config = await getOrgConfig(orgId)
  if (!config?.coreId) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS is not configured for this organization. Please set COREID first.'
    })
  }

  // Bootstrap: ensure account exists if not yet created
  if (!config.windowsDnsAccountId && config.coreId) {
    const orgName = auth.currentOrgName ?? `Org ${orgId}`
    const { accountId } = await ensureAccount(config, orgId, orgName, config.coreId)
    config = { ...config, windowsDnsAccountId: accountId }
  }

  if (!config.windowsDnsAccountId) {
    throw createError({
      statusCode: 400,
      message: 'Windows DNS account not set up. Please configure COREID first.'
    })
  }

  try {
    const client = await getClientForOrg(orgId)
    const scopes = deriveTokenScopes(new Set(['windows-dns:view']))
    const zones = await client.listZones(scopes)

    return {
      zones,
      moduleRights: {
        canManageZones: moduleRights.canCreateZones || moduleRights.canEditZones,
        canEditRecords: moduleRights.canEditRecords,
        canAutodiscover: moduleRights.canAutodiscover,
        canManageOrgConfig: moduleRights.canManageOrgConfig
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Failed to fetch zones from Windows DNS.'
    })
  }
})

