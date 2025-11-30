import { computed, useAsyncData, useColorMode } from '#imports'
import type { BrandingState } from '~/types/auth'
import { DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY } from '~~/shared/branding'

const DEFAULT_BACKGROUND_COLOR = '#0f172a'

export const useLoginBranding = () => {
  const { data, pending, error, refresh } = useAsyncData('login-branding', () =>
    $fetch<BrandingState>('/api/login-branding', { credentials: 'include' })
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
    const color = theme?.loginBackgroundTint ?? DEFAULT_BACKGROUND_COLOR
    const opacity = clampOpacity(
      theme?.loginBackgroundTintOpacity ?? DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY
    )
    const secondaryOpacity = clampOpacity(opacity * 0.75)
    return {
      color,
      url: theme?.loginBackgroundUrl ?? null,
      opacity,
      secondaryOpacity
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

