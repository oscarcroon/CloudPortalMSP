import { navigateTo } from '#imports'
import { useModules } from '~/composables/useModules'
import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()
  const { modules, fetchVisibleModules, loading } = useModules()

  if (!auth.currentOrg.value?.id) {
    return
  }

  // Fetch modules if not loaded
  if (!modules.value.length && !loading.value) {
    await fetchVisibleModules()
  }

  // Find the module that matches this route
  const target = modules.value.find((mod) => to.path.startsWith(mod.routePath))
  if (!target) return

  // Block access if module is:
  // 1. Not effectively enabled (inaktiverad)
  // 2. Effectively disabled (avaktiverad eller kommer snart)
  // 3. Disabled (avaktiverad eller kommer snart)
  if (!target.effectiveEnabled || target.effectiveDisabled || target.disabled) {
    return navigateTo('/?error=module-disabled', { replace: true })
  }
})


