export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function matchesSearch(haystack: string, needle: string): boolean {
  const h = normalizeText(haystack)
  const n = normalizeText(needle)
  if (!n) return true
  return h.includes(n)
}

