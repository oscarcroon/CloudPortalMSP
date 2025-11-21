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
      const data = await $fetch<AuthPayload>('/api/auth/me', { credentials: 'include' })
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

  const login = async (payload: { email: string; password: string }) => {
    state.value.loading = true
    try {
      await $fetch<AuthPayload>('/api/auth/login', {
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
    await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    state.value.data = null
    state.value.initialized = true
  }

  const switchOrganization = async (organizationId: string) => {
    state.value.loading = true
    try {
      const data = await $fetch<AuthPayload>('/api/auth/switch-org', {
        method: 'POST',
        body: { organizationId },
        credentials: 'include'
      })
      applyAuthPayload(data)
      return data
    } finally {
      state.value.loading = false
    }
  }

  const currentOrg = computed(() => {
    const orgId = state.value.data?.currentOrgId
    return state.value.data?.organizations.find((org) => org.id === orgId) ?? null
  })

  const isSuperAdmin = computed(() => Boolean(state.value.data?.user?.isSuperAdmin))

  return {
    state,
    user: computed(() => state.value.data?.user ?? null),
    organizations: computed(() => state.value.data?.organizations ?? []),
    currentOrg,
    orgRoles: computed(() => state.value.data?.orgRoles ?? {}),
    isSuperAdmin,
    loading: computed(() => state.value.loading),
    initialized: computed(() => state.value.initialized),
    error: computed(() => state.value.error),
    bootstrap,
    fetchMe,
    login,
    logout,
    switchOrganization
  }
}

