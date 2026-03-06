/**
 * Parsed SOA record fields
 */
export interface ParsedSoa {
  primaryNs: string
  responsibleParty: string
  responsiblePartyEmail: string | null
  serial: string
  refresh: string
  retry: string
  expire: string
  minimum: string
  extra: string[]
  raw: string
  isValid: boolean
}

/**
 * Parse SOA record content into structured fields.
 *
 * SOA content format (RFC 1035):
 * <primary-ns> <responsible-party> <serial> <refresh> <retry> <expire> <minimum>
 *
 * Example:
 * "ns1.example.com. hostmaster.example.com. 2024010101 3600 900 604800 86400"
 *
 * This parser handles:
 * - Single-line format
 * - Multi-line format with parentheses
 * - BIND-style comments (;...)
 * - Extra whitespace/newlines
 *
 * @param content - The SOA record content string
 * @returns Parsed SOA fields
 */
export function parseSoaContent(content: unknown): ParsedSoa {
  const raw = String(content ?? '')

  // Normalize the content
  let s = raw.trim()
  // Replace newlines with spaces
  s = s.replace(/\r?\n/g, ' ')
  // Remove parentheses (used in multi-line SOA)
  s = s.replace(/[()]/g, ' ')
  // Remove BIND-style comments (; ...)
  s = s.replace(/;[^\n]*/g, '')
  // Normalize whitespace to single spaces
  s = s.replace(/\s+/g, ' ').trim()

  // Tokenize
  const tokens = s.split(' ').filter(Boolean)

  // We need at least 7 tokens for a valid SOA
  if (tokens.length >= 7) {
    const responsibleParty = tokens[1]!
    // Convert DNS format (hostmaster.example.com.) to email (hostmaster@example.com)
    let responsiblePartyEmail: string | null = null
    if (responsibleParty && responsibleParty.includes('.')) {
      // First dot becomes @, rest stay as dots, trailing dot removed
      const parts = responsibleParty.replace(/\.$/, '').split('.')
      if (parts.length >= 2) {
        responsiblePartyEmail = `${parts[0]}@${parts.slice(1).join('.')}`
      }
    }

    return {
      primaryNs: tokens[0]!,
      responsibleParty,
      responsiblePartyEmail,
      serial: tokens[2]!,
      refresh: tokens[3]!,
      retry: tokens[4]!,
      expire: tokens[5]!,
      minimum: tokens[6]!,
      extra: tokens.slice(7),
      raw,
      isValid: true
    }
  }

  // Invalid or unexpected format
  return {
    primaryNs: '—',
    responsibleParty: '—',
    responsiblePartyEmail: null,
    serial: '—',
    refresh: '—',
    retry: '—',
    expire: '—',
    minimum: '—',
    extra: tokens,
    raw,
    isValid: false
  }
}

/**
 * Format seconds as human-readable duration
 * @param seconds - Duration in seconds (as string or number)
 * @returns Human-readable string like "1h", "30m", "1d"
 */
export function formatDuration(seconds: string | number): string {
  const sec = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds
  if (isNaN(sec)) return String(seconds)

  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  if (sec < 86400) return `${Math.round(sec / 3600)}h`
  return `${Math.round(sec / 86400)}d`
}

