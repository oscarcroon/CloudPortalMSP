import { useCookie, useNuxtApp } from '#imports'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'color-theme-preference'

export const useThemeStore = defineStore('theme', () => {
  const nuxtApp = useNuxtApp()
  const serverColorMode = nuxtApp.ssrContext?.event.context.colorMode

  const preferenceCookie = useCookie<ThemePreference | null>(STORAGE_KEY, {
    sameSite: 'lax',
    secure: !import.meta.dev
  })

  const preference = ref<ThemePreference>(serverColorMode?.preference ?? 'system')
  const currentTheme = ref<Theme>(serverColorMode?.resolved ?? 'light')
  const isInitialized = ref(false)
  let mediaQuery: MediaQueryList | null = null

  const cookiePreference = preferenceCookie.value
  if (isValidPreference(cookiePreference)) {
    preference.value = cookiePreference
  }

  resolveTheme()

  function applyTheme(theme: Theme) {
    currentTheme.value = theme
    if (!import.meta.client) {
      return
    }

    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  function resolveTheme() {
    if (preference.value === 'system') {
      applyTheme(resolveSystemTheme())
      return
    }

    applyTheme(preference.value)
  }

  function handleSystemChange(event: MediaQueryListEvent) {
    if (preference.value !== 'system') {
      return
    }
    applyTheme(event.matches ? 'dark' : 'light')
  }

  function setPreference(nextPreference: ThemePreference) {
    preference.value = nextPreference
    preferenceCookie.value = nextPreference
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, nextPreference)
    }
    resolveTheme()
  }

  function toggle() {
    setPreference(currentTheme.value === 'dark' ? 'light' : 'dark')
  }

  function init() {
    if (isInitialized.value || !import.meta.client) {
      return
    }

    const storedPreference = localStorage.getItem(STORAGE_KEY)
    if (
      storedPreference === 'light' ||
      storedPreference === 'dark' ||
      storedPreference === 'system'
    ) {
      preference.value = storedPreference
      preferenceCookie.value = storedPreference
    }

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemChange)
    resolveTheme()
    isInitialized.value = true
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      mediaQuery?.removeEventListener('change', handleSystemChange)
    })
  }

  const isDark = computed(() => currentTheme.value === 'dark')

  function resolveSystemTheme(): Theme {
    if (import.meta.server) {
      return serverColorMode?.resolved ?? 'light'
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }

  return {
    preference,
    currentTheme,
    isDark,
    init,
    toggle,
    setPreference
  }
})

function isValidPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

