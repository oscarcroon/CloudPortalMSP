/**
 * Cloudflare DNS — DNS Challenge Provider Registration
 *
 * Registers the Cloudflare DNS layer as a DNS-01 challenge provider.
 * Only loaded when the cloudflare-dns layer is active.
 */

import {
  registerDnsChallengeProvider,
  type DnsChallengeProvider
} from '../../../_shared/dns-challenge-providers'
import { getOrgConfig, getZoneCache } from '../lib/cloudflare-dns/org-config'
import { CloudflareClient, getClientForOrg } from '../lib/cloudflare-dns/client'

const provider: DnsChallengeProvider = {
  label: 'Cloudflare',

  async listZones(orgId: string) {
    const zones = await getZoneCache(orgId)
    return zones.map(z => ({ id: z.zoneId, name: z.name }))
  },

  async getZoneName(orgId: string, zoneId: string) {
    const zones = await getZoneCache(orgId)
    const zone = zones.find(z => z.zoneId === zoneId)
    return zone?.name ?? null
  },

  async createTxt(orgId: string, zoneId: string, relativeName: string, challengeValue: string) {
    const client = await getClientForOrg(orgId)

    // Idempotent: check if record already exists before creating
    const existing = await client.listRecords(zoneId)
    const alreadyExists = existing.some(
      r => r.type === 'TXT' && r.name?.endsWith(relativeName) && r.content === challengeValue
    )
    if (alreadyExists) return

    await client.createRecord(zoneId, {
      type: 'TXT',
      name: relativeName,
      content: challengeValue,
      ttl: 60
    })
  },

  async deleteTxt(orgId: string, zoneId: string, relativeName: string, challengeValue: string) {
    const client = await getClientForOrg(orgId)

    // Find the specific record matching name + content
    const records = await client.listRecords(zoneId)
    const match = records.find(
      r => r.type === 'TXT' && r.name?.endsWith(relativeName) && r.content === challengeValue
    )

    if (!match) return // Already deleted — idempotent

    await client.deleteRecord(zoneId, match.id)
  }
}

export default defineNitroPlugin(() => {
  registerDnsChallengeProvider('cloudflare', provider)
  console.log('[cloudflare-dns] Registered as DNS challenge provider')
})
