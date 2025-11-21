import { useHead } from '#imports'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '~/stores/theme'

export default defineNuxtPlugin(() => {
  const themeStore = useThemeStore()
  const { currentTheme } = storeToRefs(themeStore)

  useHead(() => ({
    htmlAttrs: {
      class: currentTheme.value === 'dark' ? 'dark' : undefined
    }
  }))

  if (import.meta.client) {
    themeStore.init()
  }
})

