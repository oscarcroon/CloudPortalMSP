import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getWindowsDnsModuleAccessForUser } from '@windows-dns/server/lib/windows-dns/access'
import { getClientForOrg } from '@windows-dns/server/lib/windows-dns/client'
import { getOrgConfig } from '@windows-dns/server/lib/windows-dns/org-config'
import { ensureAccount } from '@windows-dns/server/lib/windows-dns/client'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organization missing from session.' })
  }

  const orgId = auth.currentOrgId
  const moduleRights = await getWindowsDnsModuleAccessForUser(orgId, auth.user.id)

  if (!moduleRights.canAutodiscover) {
    throw createError({ statusCode: 403, message: 'No permission to run autodiscover.' })
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
  if (!config.windowsDnsAccountId) {
    const orgName = auth.currentOrgName ?? `Org ${orgId}`
    const { accountId } = await ensureAccount(config, orgId, orgName, config.coreId)
    config = { ...config, windowsDnsAccountId: accountId }
  }

  try {
    const client = await getClientForOrg(orgId)
    const zones = await client.autodiscoverZones()

    return { zones }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 502,
      message: error?.message ?? 'Autodiscover failed.'
    })
  }
})

