/**
 * Windows DNS — DNS Challenge Provider Registration
 *
 * Registers the Windows DNS layer as a DNS-01 challenge provider.
 * Only loaded when the windows-dns layer is active.
 */

import {
  registerDnsChallengeProvider,
  type DnsChallengeProvider
} from '../../../_shared/dns-challenge-providers'
import { getOrgConfig } from '../lib/windows-dns/org-config'
import { getAllowedZones } from '../lib/windows-dns/org-config'
import { WindowsDnsClient } from '../lib/windows-dns/client'

const provider: DnsChallengeProvider = {
  label: 'Windows DNS',

  async listZones(orgId: string) {
    const config = await getOrgConfig(orgId)
    if (!config?.windowsDnsAccountId) return []

    const zones = await getAllowedZones(orgId)
    return zones.map(z => ({ id: z.zoneId, name: z.zoneName ?? '' }))
  },

  async getZoneName(orgId: string, zoneId: string) {
    const zones = await getAllowedZones(orgId)
    const zone = zones.find(z => z.zoneId === zoneId)
    return zone?.zoneName ?? null
  },

  async createTxt(orgId: string, zoneId: string, relativeName: string, challengeValue: string) {
    const config = await getOrgConfig(orgId)
    if (!config?.windowsDnsAccountId) {
      throw new Error('Windows DNS account not configured for this organization')
    }

    const client = new WindowsDnsClient(orgId, config)
    try {
      await client.createRecordInZone(zoneId, {
        name: relativeName,
        type: 'TXT',
        content: challengeValue,
        ttl: 60
      })
    } catch (err: any) {
      // Idempotent: if record already exists, treat as success
      if (err?.statusCode === 409 || err?.message?.includes('already exists')) {
        return
      }
      throw err
    }
  },

  async deleteTxt(orgId: string, zoneId: string, relativeName: string, challengeValue: string) {
    const config = await getOrgConfig(orgId)
    if (!config?.windowsDnsAccountId) {
      throw new Error('Windows DNS account not configured for this organization')
    }

    const client = new WindowsDnsClient(orgId, config)
    try {
      // Windows DNS deleteRecord matches by name + type + content
      await client.deleteRecord(zoneId, {
        name: relativeName,
        type: 'TXT',
        content: challengeValue
      })
    } catch (err: any) {
      // Idempotent: if record not found, treat as success
      if (err?.statusCode === 404 || err?.message?.includes('not found')) {
        return
      }
      throw err
    }
  }
}

export default defineNitroPlugin(() => {
  registerDnsChallengeProvider('windows-dns', provider)
  console.log('[windows-dns] Registered as DNS challenge provider')
})
