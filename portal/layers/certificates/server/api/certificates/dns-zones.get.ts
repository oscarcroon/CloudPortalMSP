/**
 * GET /api/certificates/dns-zones
 *
 * Lists DNS zones from all registered DNS challenge providers for the current org.
 * Used by the order wizard to let users select a zone for DNS-01 validation.
 */

import { ensureAuthState } from '~~/server/utils/session'
import { getCertificatesModuleAccessForUser } from '../../lib/certificates/access'
import { getAllDnsChallengeProviders } from '../../../../_shared/dns-challenge-providers'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canOrder && !access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to view DNS zones.' })
    }
  }

  const providers = getAllDnsChallengeProviders()
  const zones: { id: string; name: string; provider: string }[] = []
  const providerStatuses: { key: string; label: string; status: string; message?: string }[] = []

  for (const [key, provider] of providers) {
    try {
      const providerZones = await provider.listZones(orgId)
      for (const z of providerZones) {
        zones.push({ id: z.id, name: z.name, provider: key })
      }
      providerStatuses.push({ key, label: provider.label, status: 'ok' })
    } catch (err: any) {
      providerStatuses.push({
        key,
        label: provider.label,
        status: 'not_configured',
        message: err?.message ?? 'Provider not available'
      })
    }
  }

  return { zones, providers: providerStatuses }
})
