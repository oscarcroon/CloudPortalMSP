/**
 * Normaliserar en logotyp-URL för att säkerställa att den använder rätt sökväg.
 * Konverterar gamla format (/uploads/logos/...) till nya format (/api/uploads/logos/...)
 * Konverterar fullständiga URL:er (inklusive localhost) till relativa sökvägar
 * Hanterar också dubblerade /api/api/ prefix
 */
export function normalizeLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) {
    return null
  }

  // Ta bort dubblerade /api/api/ prefix först
  let normalized = logoUrl.replace(/\/api\/api\//g, '/api/')

  // Konvertera fullständiga URL:er (inklusive localhost) till relativa sökvägar
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    // Extrahera sökvägen från URL:en
    try {
      const url = new URL(normalized)
      normalized = url.pathname
    } catch {
      // Om URL-parsing misslyckas, försök extrahera sökväg manuellt
      const match = normalized.match(/https?:\/\/[^/]+(\/.*)/)
      if (match) {
        normalized = match[1]!
      }
    }
    // Normalisera sökvägsformatet
    normalized = normalized.replace(/\/uploads\/logos\//, '/api/uploads/logos/')
    normalized = normalized.replace(/\/api\/api\//g, '/api/')
  }

  // Konvertera relativa sökvägar från /uploads/logos/ till /api/uploads/logos/
  if (normalized.startsWith('/uploads/logos/')) {
    normalized = normalized.replace('/uploads/logos/', '/api/uploads/logos/')
  }

  // Om det redan är /api/uploads/logos/, returnera som den är
  if (normalized.startsWith('/api/uploads/logos/')) {
    return normalized
  }

  // För alla andra fall, returnera som den är
  return normalized
}

