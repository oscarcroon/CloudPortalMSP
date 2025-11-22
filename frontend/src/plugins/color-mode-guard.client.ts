import { useColorMode } from '#imports'

export default defineNuxtPlugin(() => {
  if (import.meta.server) {
    return
  }

  const colorMode = useColorMode()
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  function syncSystemPreference(event?: MediaQueryListEvent) {
    if (colorMode.preference !== 'system') {
      return
    }

    const prefersDark = event?.matches ?? mediaQuery.matches
    const targetValue = prefersDark ? 'dark' : 'light'

    if (colorMode.value !== targetValue) {
      colorMode.value = targetValue
    }
  }

  syncSystemPreference()
  mediaQuery.addEventListener('change', syncSystemPreference)

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      mediaQuery.removeEventListener('change', syncSystemPreference)
    })
  }
})

