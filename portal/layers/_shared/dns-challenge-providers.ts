/**
 * DNS Challenge Provider Registry
 *
 * In-memory registry for DNS-01 challenge automation.
 * DNS layers (windows-dns, cloudflare-dns) self-register at Nitro startup.
 * The certificates layer queries at runtime — zero hard coupling.
 */

export interface DnsChallengeProvider {
  label: string
  listZones(orgId: string): Promise<{ id: string; name: string }[]>
  getZoneName(orgId: string, zoneId: string): Promise<string | null>
  createTxt(orgId: string, zoneId: string, relativeName: string, challengeValue: string): Promise<void>
  deleteTxt(orgId: string, zoneId: string, relativeName: string, challengeValue: string): Promise<void>
}

const registry = new Map<string, DnsChallengeProvider>()

/** Register a DNS challenge provider. Idempotent — re-registering replaces the previous. */
export function registerDnsChallengeProvider(key: string, provider: DnsChallengeProvider): void {
  registry.set(key, provider)
}

/** Get a specific provider by key. Returns null if not registered. */
export function getDnsChallengeProvider(key: string): DnsChallengeProvider | null {
  return registry.get(key) ?? null
}

/** Get all registered providers. */
export function getAllDnsChallengeProviders(): Map<string, DnsChallengeProvider> {
  return registry
}

// ---------------------------------------------------------------------------
// Record Name Normalization Helpers
// ---------------------------------------------------------------------------

/**
 * Convert an FQDN record name to a zone-relative name.
 * Example: ("_acme-challenge.sub.example.com", "example.com") → "_acme-challenge.sub"
 * Throws if recordFqdn doesn't end with .zoneName (guardrail).
 */
export function getRelativeRecordName(recordFqdn: string, zoneName: string): string {
  const fqdn = recordFqdn.toLowerCase().replace(/\.$/, '')
  const zone = zoneName.toLowerCase().replace(/\.$/, '')

  if (fqdn === zone) {
    return '@'
  }

  const suffix = `.${zone}`
  if (!fqdn.endsWith(suffix)) {
    throw new Error(`Record "${recordFqdn}" does not belong to zone "${zoneName}"`)
  }

  return fqdn.slice(0, -suffix.length)
}

/**
 * Validate that a record FQDN belongs to the given zone.
 */
export function isRecordInZone(recordFqdn: string, zoneName: string): boolean {
  const fqdn = recordFqdn.toLowerCase().replace(/\.$/, '')
  const zone = zoneName.toLowerCase().replace(/\.$/, '')
  return fqdn === zone || fqdn.endsWith(`.${zone}`)
}
