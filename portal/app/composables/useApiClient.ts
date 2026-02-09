type SimpleFetch = <T = any>(url: string, opts?: Record<string, any>) => Promise<T>

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH', 'post', 'put', 'delete', 'patch'])

const readCsrfCookie = (): string | undefined => {
  if (import.meta.server) return undefined
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

export const useApiClient = (): SimpleFetch => {
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.public.apiBase,
    credentials: 'include',
    onRequest({ options }) {
      const method = (options.method || 'GET').toString().toUpperCase()
      if (STATE_CHANGING_METHODS.has(method)) {
        const csrfToken = readCsrfCookie()
        if (csrfToken) {
          const headers = new Headers(options.headers as HeadersInit)
          headers.set('X-CSRF-Token', csrfToken)
          options.headers = headers
        }
      }
    }
  }) as unknown as SimpleFetch
}

