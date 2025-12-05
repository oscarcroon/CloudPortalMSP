import { watch } from '#imports'
import { useAuth } from '~/composables/useAuth'
import { DEFAULT_BRANDING_ACCENT, normalizeHexColor } from '~~/shared/branding'

export default defineNuxtPlugin(() => {
  if (import.meta.server) {
    return
  }

  const auth = useAuth()

  const applyBranding = () => {
    const accent = auth.branding.value?.activeTheme.accentColor ?? DEFAULT_BRANDING_ACCENT
    setBrandVariables(accent)
  }

  watch(
    () => auth.branding.value,
    () => {
      applyBranding()
    },
    { immediate: true, deep: true }
  )
})

function setBrandVariables(hexColor: string) {
  const normalized = safeNormalizeHex(hexColor)
  const rgb = hexToRgb(normalized)
  const root = document.documentElement

  root.style.setProperty('--brand', `${rgb.join(' ')}`)
  root.style.setProperty('--brand-dark', `${mixRgb(rgb, [0, 0, 0], 0.35).join(' ')}`)
  root.style.setProperty('--brand-light', `${mixRgb(rgb, [255, 255, 255], 0.82).join(' ')}`)
  root.style.setProperty('--brand-hex', normalized)
}

function safeNormalizeHex(value: string) {
  try {
    return normalizeHexColor(value)
  } catch {
    return DEFAULT_BRANDING_ACCENT
  }
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return [r, g, b]
}

function mixRgb(base: number[], target: number[], amount: number) {
  return base.map((channel, index) =>
    Math.round(channel + (target[index] - channel) * amount)
  )
}

