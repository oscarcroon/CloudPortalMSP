import { computed, useAsyncData, useRequestHeaders } from '#imports'
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
  const currentOrgId = computed(() => auth.currentOrg.value?.id)

  const headers = useRequestHeaders(['cookie'])
  
  const { data: visibleModules, pending: loading, refresh: fetchVisibleModules } = useAsyncData<VisibleModule[]>(
    () => `visible-modules-${currentOrgId.value || 'none'}`,
    async () => {
      const orgId = currentOrgId.value
      if (!orgId) {
        return []
      }

      try {
        const response = await $fetch<{ modules: VisibleModule[] }>(
          `/api/organizations/${orgId}/modules/visible`,
          {
            credentials: 'include',
            headers: import.meta.server ? headers : undefined
          }
        )
        return response.modules || []
      } catch (error) {
        console.error('Failed to fetch visible modules:', error)
        return []
      }
    },
    {
      default: () => [],
      watch: [currentOrgId]
    }
  )

  /**
   * Get visible modules (computed for reactivity)
   */
  const modules = computed(() => visibleModules.value || [])

  /**
   * Check if a module is visible (enabled, even if disabled/deactivated)
   */
  const isModuleVisible = (moduleId: string) => {
    return (visibleModules.value || []).some((m: any) => m.id === moduleId)
  }

  /**
   * Check if a module is disabled (deactivated)
   */
  const isModuleDisabled = (moduleId: string) => {
    const module = (visibleModules.value || []).find((m: any) => m.id === moduleId)
    return module?.disabled === true
  }

  return {
    modules,
    visibleModules,
    loading,
    fetchVisibleModules,
    isModuleVisible,
    isModuleDisabled
  }
}

