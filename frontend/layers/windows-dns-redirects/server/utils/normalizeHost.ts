export function normalizeRedirectHost(hostInput: string | null | undefined, zoneName: string): string {
  const raw = String(hostInput ?? '').trim()
  const zone = String(zoneName ?? '').trim()
  if (!zone) return raw

  if (!raw || raw === '@') return zone

  // If user typed full hostname, accept as-is (validated below)
  if (raw.includes('.')) {
    if (!raw.endsWith(zone)) {
      throw new Error(`Host "${raw}" must be within zone "${zone}".`)
    }
    return raw
  }

  // Subdomain label (e.g. "www" or "a.b" if user typed dots would be caught above)
  return `${raw}.${zone}`
}

export function hostToZoneRecordName(fullHost: string, zoneName: string): string {
  const host = String(fullHost ?? '').trim()
  const zone = String(zoneName ?? '').trim()
  if (!host || !zone) return '@'

  if (host === zone) return '@'

  const suffix = `.${zone}`
  if (!host.endsWith(suffix)) {
    throw new Error(`Host "${host}" must be within zone "${zone}".`)
  }
  const recordName = host.slice(0, -suffix.length)
  return recordName || '@'
}

