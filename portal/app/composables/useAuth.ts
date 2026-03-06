import { computed, shallowRef, useState } from '#imports'
import type { AuthPayload } from '~/types/auth'

interface AuthState {
  data: AuthPayload | null
  loading: boolean
  initialized: boolean
  error: string | null
}

const initialState: AuthState = {
  data: null,
  loading: false,
  initialized: false,
  error: null
}

let hasLoggedFallbackWarning = false

const useAuthState = () => {
  try {
    return useState<AuthState>('auth-state', () => structuredClone(initialState))
  } catch (error) {
    if (import.meta.dev && !hasLoggedFallbackWarning) {
      console.warn(
        '[useAuth] Falling back to local state because Nuxt app context is unavailable.',
        error
      )
      hasLoggedFallbackWarning = true
    }
    return shallowRef<AuthState>(structuredClone(initialState))
  }
}

const applyAuthPayload = (payload: AuthPayload | null) => {
  const state = useAuthState()
  state.value.data = payload
  state.value.error = null
  if (!state.value.initialized) {
    state.value.initialized = true
  }
  state.value.loading = false
}

export const useAuth = () => {
  const state = useAuthState()

  const setError = (message: string) => {
    state.value.error = message
  }

  const fetchMe = async () => {
    state.value.loading = true
    try {
      const data = await ($fetch as any)('/api/auth/me', { credentials: 'include' }) as AuthPayload
      applyAuthPayload(data)
      return data
    } catch {
      applyAuthPayload(null)
      return null
    }
  }

  const bootstrap = async () => {
    if (import.meta.server) {
      return
    }
    if (state.value.initialized || state.value.loading) {
      return
    }
    await fetchMe()
  }

  const login = async (payload: { email: string; password: string; mfaCode?: string }) => {
    state.value.loading = true
    try {
      await ($fetch as any)('/api/auth/login', {
        method: 'POST',
        body: payload,
        credentials: 'include'
      })
      return await fetchMe()
    } catch (error) {
      setError((error as Error).message)
      throw error
    } finally {
      state.value.loading = false
    }
  }

  const logout = async () => {
    await ($fetch as any)('/api/auth/logout', { method: 'POST', credentials: 'include' })
    state.value.data = null
    state.value.initialized = true
  }

  const switchOrganization = async (organizationId: string | null) => {
    state.value.loading = true
    try {
      const data = await ($fetch as any)('/api/auth/switch-org', {
        method: 'POST',
        body: { organizationId },
        credentials: 'include'
      }) as AuthPayload
      applyAuthPayload(data)
      return data
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Kunde inte byta organisation.')
      throw error
    } finally {
      state.value.loading = false
    }
  }

  const switchTenant = async (tenantId: string | null) => {
    state.value.loading = true
    try {
      const data = await ($fetch as any)('/api/auth/switch-tenant', {
        method: 'POST',
        body: { tenantId },
        credentials: 'include'
      }) as AuthPayload
      applyAuthPayload(data)
      return data
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Kunde inte byta tenant.')
      throw error
    } finally {
      state.value.loading = false
    }
  }

  const switchContext = async (payload: { organizationId?: string | null; tenantId?: string | null }) => {
    state.value.loading = true
    try {
      const data = await ($fetch as any)('/api/auth/context-switch', {
        method: 'POST',
        body: payload,
        credentials: 'include'
      }) as AuthPayload
      applyAuthPayload(data)
      return data
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Kunde inte byta kontext.')
      throw error
    } finally {
      state.value.loading = false
    }
  }

  const setPrimaryOrganization = async (orgId: string) => {
    state.value.loading = true
    try {
      await ($fetch as any)('/api/auth/set-primary-org', {
        method: 'POST',
        body: { orgId },
        credentials: 'include'
      })
      
      // Update local state
      if (state.value.data?.user) {
        state.value.data.user.defaultOrgId = orgId
      }
      
      return { success: true }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Kunde inte sätta primär organisation.')
      throw error
    } finally {
      state.value.loading = false
    }
  }

  const currentOrg = computed(() => {
    const orgId = state.value.data?.currentOrgId
    return state.value.data?.organizations.find((org: any) => org.id === orgId) ?? null
  })

  const currentTenant = computed(() => {
    const tenantId = state.value.data?.currentTenantId
    return state.value.data?.tenants.find((tenant: any) => tenant.id === tenantId) ?? null
  })

  const isSuperAdmin = computed(() => Boolean(state.value.data?.user?.isSuperAdmin))

  return {
    state,
    user: computed(() => state.value.data?.user ?? null),
    organizations: computed(() => state.value.data?.organizations ?? []),
    tenants: computed(() => state.value.data?.tenants ?? []),
    branding: computed(() => state.value.data?.branding ?? null),
    currentOrg,
    currentTenant,
    orgRoles: computed(() => state.value.data?.orgRoles ?? {}),
    tenantRoles: computed(() => state.value.data?.tenantRoles ?? {}),
    isSuperAdmin,
    loading: computed(() => state.value.loading),
    initialized: computed(() => state.value.initialized),
    error: computed(() => state.value.error),
    bootstrap,
    fetchMe,
    login,
    logout,
    switchOrganization,
    switchTenant,
    switchContext,
    setPrimaryOrganization
  }
}

