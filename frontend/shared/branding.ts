export interface BrandingPaletteEntry {
  key: string
  label: string
  hex: string
}

export const BRANDING_PALETTE: BrandingPaletteEntry[] = [
  { key: 'ocean', label: 'Ocean', hex: '#1C6DD0' },
  { key: 'teal', label: 'Teal', hex: '#0FA3B1' },
  { key: 'emerald', label: 'Emerald', hex: '#00A86B' },
  { key: 'amber', label: 'Amber', hex: '#F5A524' },
  { key: 'rose', label: 'Rose', hex: '#E45378' },
  { key: 'violet', label: 'Violet', hex: '#7A53E6' },
  { key: 'slate', label: 'Slate', hex: '#3A506B' },
  { key: 'charcoal', label: 'Charcoal', hex: '#1E2A38' }
]

export const BRANDING_PALETTE_MAP = BRANDING_PALETTE.reduce<Record<string, BrandingPaletteEntry>>(
  (acc, entry) => {
    acc[entry.key] = entry
    return acc
  },
  {}
)

export const DEFAULT_BRANDING_PALETTE_KEY = 'ocean'
export const DEFAULT_BRANDING_ACCENT = BRANDING_PALETTE_MAP[DEFAULT_BRANDING_PALETTE_KEY].hex
export const DEFAULT_NAV_BACKGROUND = '#0F1C2F'
export const DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY = 0.85

export function normalizeHexColor(value: string): string {
  const hex = value.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error('Ogiltig hex-färg')
  }
  return `#${hex.toUpperCase()}`
}

export function resolveAccentFromPalette(paletteKey?: string | null): string {
  if (!paletteKey) {
    return DEFAULT_BRANDING_ACCENT
  }
  const entry = BRANDING_PALETTE_MAP[paletteKey]
  return entry?.hex ?? DEFAULT_BRANDING_ACCENT
}

