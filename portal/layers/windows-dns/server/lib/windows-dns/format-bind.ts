import type { WindowsDnsRecord } from './types'

/**
 * Record type ordering for grouped output.
 * Types not in this list appear at the end in encounter order.
 */
const TYPE_ORDER = ['SOA', 'NS', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'PTR']

/**
 * Ensure a name has a trailing dot (FQDN format).
 */
const ensureTrailingDot = (name: string): string =>
  name.endsWith('.') ? name : `${name}.`

/**
 * Convert a record name to a fully qualified domain name.
 *
 * Windows DNS records use relative names (`@`, `www`, `sub.host`) while
 * BIND zone files need FQDNs (`example.com.`, `www.example.com.`).
 */
const toFqdn = (name: string, zoneName: string): string => {
  // Zone apex
  if (name === '@' || name === zoneName || name === `${zoneName}.`) {
    return ensureTrailingDot(zoneName)
  }
  // Already a FQDN containing the zone name
  const fqdnZone = ensureTrailingDot(zoneName)
  if (name.endsWith(`.${zoneName}`) || name.endsWith(`.${fqdnZone}`)) {
    return ensureTrailingDot(name)
  }
  // Relative name — prepend to zone
  return `${name}.${fqdnZone}`
}

/**
 * Format the content field for a specific record type.
 */
const formatContent = (type: string, content: string, priority?: number | null): string => {
  switch (type) {
    case 'MX':
      return `${priority ?? 0} ${ensureTrailingDot(content)}`
    case 'TXT':
      // Wrap in quotes if not already quoted
      if (content.startsWith('"') && content.endsWith('"')) return content
      return `"${content}"`
    case 'CNAME':
    case 'NS':
    case 'PTR':
      return ensureTrailingDot(content)
    default:
      return content
  }
}

/**
 * Format a zone file in BIND 9 format from records data.
 *
 * Output matches Cloudflare's export style with header, grouped record
 * sections, and tab-separated BIND fields.
 */
export const formatBindZoneFile = (zoneName: string, records: WindowsDnsRecord[]): string => {
  const now = new Date()
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 19)

  const lines: string[] = []

  // Header
  lines.push(';;')
  lines.push(`;; Domain:     ${ensureTrailingDot(zoneName)}`)
  lines.push(`;; Exported:   ${timestamp}`)
  lines.push(';;')
  lines.push(';; This file is intended for use for informational and archival')
  lines.push(';; purposes ONLY and MUST be edited before use on a production')
  lines.push(';; DNS server.')
  lines.push(';;')

  // Group records by type
  const grouped = new Map<string, WindowsDnsRecord[]>()
  for (const record of records) {
    const type = record.type.toUpperCase()
    if (!grouped.has(type)) grouped.set(type, [])
    grouped.get(type)!.push(record)
  }

  // Sort groups by TYPE_ORDER, unknown types at end
  const sortedTypes = [...grouped.keys()].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a)
    const bi = TYPE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  for (const type of sortedTypes) {
    const recs = grouped.get(type)!

    // Section comment
    lines.push('')
    if (type === 'SOA') {
      lines.push(';; SOA Record')
    } else {
      lines.push(`;; ${type} Records`)
    }

    for (const rec of recs) {
      const name = toFqdn(rec.name, zoneName)
      const content = formatContent(type, rec.content, rec.priority)
      lines.push(`${name}\t${rec.ttl}\tIN\t${type}\t${content}`)
    }
  }

  // Final newline
  lines.push('')

  return lines.join('\n')
}
