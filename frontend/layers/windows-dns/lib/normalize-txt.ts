/**
 * Normalizes TXT record content by removing surrounding double quotes.
 *
 * This function is idempotent - running it multiple times on the same input
 * will produce the same result.
 *
 * Examples:
 * - `"aaaa=1111"` → `aaaa=1111`
 * - `  "aaaa=1111"  ` → `aaaa=1111`
 * - `aaaa=1111` → `aaaa=1111` (unchanged)
 * - `"a\"b"` → `a\"b` (only outer quotes removed, inner preserved)
 * - `""` → `` (empty string)
 *
 * @param input - The TXT record content to normalize (handles unknown types defensively)
 * @returns The normalized content string
 */
export function normalizeTxtContent(input: unknown): string {
  // Defensive coercion for unknown input
  if (input === null || input === undefined) {
    return ''
  }

  let value = String(input).trim()

  // Remove exactly one pair of surrounding double quotes if present
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).trim()
  }

  return value
}

