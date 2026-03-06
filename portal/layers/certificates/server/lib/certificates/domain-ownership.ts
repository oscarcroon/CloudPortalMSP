/**
 * Domain Ownership Validation
 *
 * Checks that the requesting organization has access to the domain(s)
 * via its configured DNS zones (Cloudflare or Windows DNS).
 */

import { eq, and, like } from 'drizzle-orm'
import { getDb } from '../../../../../server/utils/db'
import {
  cloudflareDnsZonesCache,
  windowsDnsZones,
  windowsDnsZoneMemberships
} from '../../../../../server/database/schema'

export interface ZoneMatch {
  zoneId: string
  zoneName: string
  provider: 'cloudflare' | 'windows-dns'
}

/**
 * Find the best-matching zone for a domain within an organization.
 * Returns all matching zones sorted by specificity (longest match first).
 */
export async function findMatchingZones(
  orgId: string,
  domain: string
): Promise<ZoneMatch[]> {
  const db = getDb()
  const matches: ZoneMatch[] = []

  // Normalise domain
  const normalised = domain.toLowerCase().replace(/\.$/, '')

  // Check Cloudflare zones
  try {
    const cfZones = await db
      .select({
        zoneId: cloudflareDnsZonesCache.zoneId,
        name: cloudflareDnsZonesCache.name
      })
      .from(cloudflareDnsZonesCache)
      .where(eq(cloudflareDnsZonesCache.organizationId, orgId))

    for (const zone of cfZones) {
      const zoneName = zone.name.toLowerCase()
      if (normalised === zoneName || normalised.endsWith(`.${zoneName}`)) {
        matches.push({
          zoneId: zone.zoneId,
          zoneName: zone.name,
          provider: 'cloudflare'
        })
      }
    }
  } catch {
    // Cloudflare layer may not be active — skip silently
  }

  // Check Windows DNS zones
  try {
    const winZones = await db
      .select({
        id: windowsDnsZones.id,
        zoneName: windowsDnsZones.zoneName
      })
      .from(windowsDnsZones)
      .where(eq(windowsDnsZones.organizationId, orgId))

    for (const zone of winZones) {
      const zoneName = zone.zoneName.toLowerCase()
      if (normalised === zoneName || normalised.endsWith(`.${zoneName}`)) {
        matches.push({
          zoneId: zone.id,
          zoneName: zone.zoneName,
          provider: 'windows-dns'
        })
      }
    }
  } catch {
    // Windows DNS layer may not be active — skip silently
  }

  // Sort by specificity (longest zone name = most specific match)
  matches.sort((a, b) => b.zoneName.length - a.zoneName.length)

  return matches
}

/**
 * Validate that the org owns all domains in a certificate order.
 * Returns the best matching zone for the primary domain.
 */
export async function validateDomainOwnership(
  orgId: string,
  primaryDomain: string,
  sans: string[] = []
): Promise<{ valid: boolean; zone?: ZoneMatch; errors: string[] }> {
  const errors: string[] = []

  // Check primary domain
  const primaryMatches = await findMatchingZones(orgId, primaryDomain)
  if (primaryMatches.length === 0) {
    errors.push(`No matching zone found for primary domain: ${primaryDomain}`)
  }

  // Check SANs
  for (const san of sans) {
    const sanMatches = await findMatchingZones(orgId, san)
    if (sanMatches.length === 0) {
      errors.push(`No matching zone found for SAN: ${san}`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    zone: primaryMatches[0],
    errors: []
  }
}
