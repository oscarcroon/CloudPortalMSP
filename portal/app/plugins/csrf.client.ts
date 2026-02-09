export default defineNuxtPlugin(() => {
  const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH', 'post', 'put', 'delete', 'patch'])

  const readCsrfCookie = (): string | undefined => {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
    return match?.[1] ? decodeURIComponent(match[1]) : undefined
  }

  // Intercept globalThis.$fetch by wrapping it with onRequest support.
  // We replace the global function while preserving .create() and .raw().
  const original = globalThis.$fetch

  const wrapped: typeof $fetch = Object.assign(
    ((url: string, opts?: Record<string, any>) => {
      const options = opts ? { ...opts } : {}
      const method = (options.method || 'GET').toString()

      if (STATE_CHANGING_METHODS.has(method)) {
        const csrfToken = readCsrfCookie()
        if (csrfToken) {
          options.headers = {
            ...(options.headers || {}),
            'X-CSRF-Token': csrfToken
          }
        }
      }

      return original(url as any, options as any)
    }) as typeof $fetch,
    {
      raw: original.raw.bind(original),
      native: original.native.bind(original),
      create: original.create.bind(original)
    }
  )

  globalThis.$fetch = wrapped
})
