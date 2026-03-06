import { createError, defineEventHandler } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getCloudflareDnsModuleAccessForUser } from '@cloudflare-dns/server/lib/cloudflare-dns/access'
import { getMaskedOrgConfig } from '@cloudflare-dns/server/lib/cloudflare-dns/org-config'
import { resolveEffectiveModulePermissions } from '~~/server/utils/modulePermissions'
import { logWarn } from '~~/server/utils/logger'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }

  const orgId = auth.currentOrgId

  // Super admin bypass (consistent with requireModulePermission)
  if (!auth.user.isSuperAdmin) {
    const access = await getCloudflareDnsModuleAccessForUser(orgId, auth.user.id)
    if (!access.canManageApi) {
      // Log permission resolution details for debugging
      const perms = await resolveEffectiveModulePermissions({ orgId, moduleKey: 'cloudflare-dns', userId: auth.user.id })
      await logWarn(event, 'Cloudflare DNS config access denied', {
        userId: auth.user.id,
        orgId,
        policyMode: perms.policy.mode,
        allowedPermissions: [...perms.allowedPermissions],
        baselinePermissions: [...perms.baselinePermissions],
        effectivePermissions: [...perms.effectivePermissions],
        delegatedGrants: perms.delegatedGrants ? [...perms.delegatedGrants] : [],
        userDenies: [...perms.userDenies]
      })
      throw createError({
        statusCode: 403,
        message: 'Saknar behörighet att hantera Cloudflare-konfiguration.'
      })
    }
  }

  const config = await getMaskedOrgConfig(orgId)

  return {
    config: config ?? {
      accountId: null,
      tokenMasked: '',
      lastValidatedAt: null,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null
    }
  }
})


