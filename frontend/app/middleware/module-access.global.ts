import { navigateTo } from '#imports'
import { useAvailableModules } from '~/composables/useAvailableModules'
import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()
  const { allModules, refresh, pending } = useAvailableModules()

  if (!auth.currentOrg.value?.id) {
    return
  }

  if (!allModules.value.length && !pending.value) {
    await refresh()
  }

  const target = allModules.value.find((mod) => to.path.startsWith(mod.rootRoute))
  if (!target) return

  if (!target.effectiveEnabled || target.effectiveDisabled) {
    return navigateTo('/')
  }
})


