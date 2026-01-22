/**
 * Normaliserar en logotyp-URL för att säkerställa att den använder rätt sökväg.
 * Konverterar gamla format (/uploads/logos/...) till nya format (/api/uploads/logos/...)
 * Hanterar också dubblerade /api/api/ prefix
 */
export function normalizeLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) {
    return null
  }

  // Ta bort dubblerade /api/api/ prefix först
  let normalized = logoUrl.replace(/\/api\/api\//g, '/api/')

  // Om det redan är en fullständig URL (http/https)
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    // Konvertera gamla format till nya format även för fullständiga URL:er
    normalized = normalized.replace(/\/uploads\/logos\//, '/api/uploads/logos/')
    // Ta bort dubblerade /api/api/ igen om det skapades
    normalized = normalized.replace(/\/api\/api\//g, '/api/')
    return normalized
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

