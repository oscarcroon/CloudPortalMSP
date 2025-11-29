import { computed, ref } from 'vue'
import { useAuth } from './useAuth'
import type { ModuleDefinition } from '~/constants/modules'

/**
 * Extended module definition with disabled status from API
 */
export interface VisibleModule extends ModuleDefinition {
  disabled?: boolean
}

/**
 * Composable for managing modules and their visibility
 */
export const useModules = () => {
  const auth = useAuth()
  const visibleModules = ref<VisibleModule[]>([])
  const loading = ref(false)

  /**
   * Fetch visible modules for the current organization
   */
  const fetchVisibleModules = async () => {
    const currentOrgId = auth.currentOrg.value?.id
    if (!currentOrgId) {
      visibleModules.value = []
      return
    }

    loading.value = true
    try {
      const response = await $fetch(`/api/organizations/${currentOrgId}/modules/visible`)
      visibleModules.value = response.modules || []
    } catch (error) {
      console.error('Failed to fetch visible modules:', error)
      visibleModules.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Get visible modules (computed for reactivity)
   */
  const modules = computed(() => visibleModules.value)

  /**
   * Check if a module is visible (enabled, even if disabled/deactivated)
   */
  const isModuleVisible = (moduleId: string) => {
    return visibleModules.value.some((m) => m.id === moduleId)
  }

  /**
   * Check if a module is disabled (deactivated)
   */
  const isModuleDisabled = (moduleId: string) => {
    const module = visibleModules.value.find((m) => m.id === moduleId)
    return module?.disabled === true
  }

  return {
    modules,
    visibleModules,
    loading,
    fetchVisibleModules,
    isModuleVisible
  }
}

