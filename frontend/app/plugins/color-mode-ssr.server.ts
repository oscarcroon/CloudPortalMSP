import { useColorMode, useRequestEvent } from '#imports'
import { parseCookies } from 'h3'

const STORAGE_KEY = 'color-theme-preference'
const persistedPreferences = new Set(['light', 'dark'])

export default defineNuxtPlugin(() => {
  if (!import.meta.server) {
    return
  }

  const event = useRequestEvent()
  if (!event) {
    return
  }

  const cookies = parseCookies(event)
  const storedPreference = cookies[STORAGE_KEY]

  if (!persistedPreferences.has(storedPreference)) {
    return
  }

  const colorMode = useColorMode()
  colorMode.preference = storedPreference as 'light' | 'dark'
  colorMode.value = storedPreference as 'light' | 'dark'
})

