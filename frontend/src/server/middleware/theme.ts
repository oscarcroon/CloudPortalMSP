import { defineEventHandler, getCookie, getHeader, setHeader } from 'h3'

type ThemePreference = 'system' | 'light' | 'dark'
type Theme = 'light' | 'dark'

export default defineEventHandler((event) => {
  setHeader(event, 'Accept-CH', 'Sec-CH-Prefers-Color-Scheme')

  const cookiePreference = (getCookie(event, 'color-theme-preference') as ThemePreference | undefined) ?? 'system'
  const headerPreference = getHeader(event, 'sec-ch-prefers-color-scheme')

  if (headerPreference) {
    const existingVary = getHeader(event, 'vary')
    setHeader(event, 'Vary', existingVary ? `${existingVary}, Sec-CH-Prefers-Color-Scheme` : 'Sec-CH-Prefers-Color-Scheme')
  }

  const resolved: Theme =
    cookiePreference === 'system'
      ? headerPreference?.includes('dark')
        ? 'dark'
        : 'light'
      : cookiePreference

  event.context.colorMode = {
    preference: cookiePreference,
    resolved
  }
})

