import { computed, useAsyncData, useColorMode } from '#imports'
import type { BrandingState } from '~/types/auth'
import { DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY } from '~~/shared/branding'

const DEFAULT_DARK_BACKGROUND = '#0f172a'
const DEFAULT_LIGHT_BACKGROUND = '#f5f7fb'

export const useLoginBranding = () => {
  const { data, pending, error, refresh } = useAsyncData('login-branding', () =>
    ($fetch as any)('/api/login-branding', { credentials: 'include' }) as Promise<BrandingState>
  )
  const colorMode = useColorMode()

  const branding = computed(() => data.value ?? null)
  const activeTheme = computed(() => branding.value?.activeTheme ?? null)

  const loginLogo = computed(() => {
    const theme = activeTheme.value
    if (!theme) {
      return null
    }
    if (colorMode.value === 'dark') {
      return (
        theme.loginLogoDarkUrl ??
        theme.loginLogoLightUrl ??
        theme.appLogoDarkUrl ??
        theme.appLogoLightUrl ??
        theme.logoUrl
      )
    }
    return (
      theme.loginLogoLightUrl ??
      theme.loginLogoDarkUrl ??
      theme.appLogoLightUrl ??
      theme.logoUrl
    )
  })

  const accentColor = computed(() => activeTheme.value?.accentColor ?? null)

  const background = computed(() => {
    const theme = activeTheme.value
    const hasImage = Boolean(theme?.loginBackgroundUrl)
    const fallbackColor =
      colorMode.value === 'dark' ? DEFAULT_DARK_BACKGROUND : DEFAULT_LIGHT_BACKGROUND
    const color = hasImage
      ? theme?.loginBackgroundTint ?? DEFAULT_DARK_BACKGROUND
      : fallbackColor
    const opacity = hasImage
      ? clampOpacity(
          theme?.loginBackgroundTintOpacity ?? DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY
        )
      : 0
    const secondaryOpacity = hasImage ? clampOpacity(opacity * 0.75) : 0
    return {
      color,
      url: hasImage ? theme?.loginBackgroundUrl ?? null : null,
      opacity,
      secondaryOpacity,
      fallbackColor
    }
  })

  return {
    branding,
    pending,
    error,
    refresh,
    loginLogo,
    accentColor,
    background
  }
}

function clampOpacity(value: number) {
  if (Number.isNaN(value)) {
    return DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY
  }
  return Math.min(Math.max(value, 0), 1)
}

