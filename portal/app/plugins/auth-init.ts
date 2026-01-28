import { useAuth } from '~/composables/useAuth'

export default defineNuxtPlugin(async (nuxtApp) => {
  const auth = useAuth()

  if (import.meta.server) {
    const serverAuth = nuxtApp.ssrContext?.event?.context.auth ?? null
    auth.state.value.data = serverAuth
    auth.state.value.initialized = true
    auth.state.value.loading = false
    auth.state.value.error = null
    return
  }

  if (!auth.initialized.value && !auth.loading.value) {
    await auth.bootstrap()
  }
})

